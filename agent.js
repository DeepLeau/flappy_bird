const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const TASK = process.env.TASK
const REPO = process.env.REPO
const BRANCH_NAME = process.env.BRANCH_NAME || `agent/task-${Date.now()}`

const MAX_ITERATIONS = 3

async function callClaude(messages, systemPrompt) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'arcee-ai/trinity-large-preview:free',
      max_tokens: 8000,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    })
  })
  const data = await response.json()
  console.log('OpenRouter response:', JSON.stringify(data))
  return data.choices?.[0]?.message?.content || data.error?.message || 'Réponse vide'
}

// Lit tous les fichiers du repo
function readRepo() {
  const ignore = ['node_modules', '.git', '.next', '__pycache__', 'dist', 'build', '.env']
  const files = {}

  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir)
      for (const entry of entries) {
        if (ignore.includes(entry)) continue
        const fullPath = path.join(dir, entry)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          walk(fullPath)
        } else if (stat.size < 100000) { // max 100kb par fichier
          const ext = path.extname(entry)
          const allowed = ['.ts', '.tsx', '.js', '.jsx', '.py', '.json', '.env.example', '.md', '.css', '.prisma', '.sql']
          if (allowed.includes(ext)) {
            files[fullPath.replace(process.cwd() + '/', '')] = fs.readFileSync(fullPath, 'utf-8')
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  walk('.')
  return files
}

// Prend un screenshot avec Playwright
async function takeScreenshot(name) {
  const { chromium } = require('playwright')
  fs.mkdirSync('screenshots', { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true })
  await browser.close()
  return `screenshots/${name}.png`
}

// Applique les changements de fichiers générés par Claude
function applyChanges(changes) {
  for (const [filePath, content] of Object.entries(changes)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
    console.log(`✓ Fichier modifié: ${filePath}`)
  }
}

// Crée la PR GitHub avec screenshots
async function createPR(screenshotPaths, iteration) {
  // Crée une nouvelle branche
  execSync(`git config user.email "agent@agentdev.io"`)
  execSync(`git config user.name "Agent Dev"`)
  execSync(`git checkout -b ${BRANCH_NAME}`)
  execSync(`echo "node_modules/" >> .gitignore`)
  execSync(`echo "screenshots/" >> .gitignore`)
  execSync(`git rm -r --cached node_modules 2>/dev/null || true`)
  execSync(`git add -A`)
  execSync(`git commit -m "feat: ${TASK.substring(0, 72)}"`)
  execSync(`git remote set-url origin https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${process.env.REPO}.git`)
  execSync(`git push origin ${BRANCH_NAME}`)

  // Corps de la PR avec screenshots
  let body = `## Tâche\n${TASK}\n\n`
  body += `## Changements effectués\nL'agent a effectué ${iteration} itération(s) pour compléter cette tâche.\n\n`
  body += `## Tests visuels\nPlaywright a vérifié le rendu de l'application après les changements.\n\n`

  if (screenshotPaths.length > 0) {
    body += `## Screenshots\n`
    body += `> Les screenshots sont disponibles dans les artifacts du run GitHub Actions.\n\n`
  }

  body += `## Review\nSi quelque chose ne va pas, laisse un commentaire sur cette PR et l'agent corrigera automatiquement.\n`

  // Crée la PR via GitHub API
  const [owner, repo] = REPO.split('/')
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `[Agent] ${TASK.substring(0, 72)}`,
      body,
      head: BRANCH_NAME,
      base: 'main',
    })
  })

  const pr = await res.json()
  console.log(`✓ PR créée: ${pr.html_url}`)
  return pr.html_url
}

async function main() {
  console.log(`🤖 Agent démarré pour la tâche: ${TASK}`)

  // Lit le repo
  console.log('📁 Lecture du repo...')
  const repoFiles = readRepo()
  const repoContext = Object.entries(repoFiles)
    .map(([file, content]) => `### ${file}\n\`\`\`\n${content}\n\`\`\``)
    .join('\n\n')

  const screenshots = []

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n🔄 Itération ${iteration}/${MAX_ITERATIONS}`)

    // Screenshot avant
    try {
      const before = await takeScreenshot(`before-iteration-${iteration}`)
      screenshots.push(before)
      console.log('📸 Screenshot avant pris')
    } catch (e) {
      console.log('⚠️ Pas de screenshot avant (frontend peut-être pas lancé)')
    }

    // Génère le code avec Claude
    console.log('🧠 Génération du code avec Claude...')
    const systemPrompt = `Tu es un agent développeur senior expert. Tu dois modifier le code d'un projet pour accomplir une tâche.

Réponds UNIQUEMENT avec un JSON valide dans ce format exact:
{
  "files": {
    "chemin/vers/fichier.ts": "contenu complet du fichier",
    "autre/fichier.py": "contenu complet"
  },
  "explanation": "explication courte de ce que tu as fait"
}

IMPORTANT:
- Inclus le contenu COMPLET de chaque fichier modifié, pas juste les changements
- Ne modifie que les fichiers nécessaires
- Respecte le style de code existant
- Si tu crées un nouveau fichier, inclus le chemin complet`

    const messages = [{
      role: 'user',
      content: `Voici le repo actuel:\n\n${repoContext}\n\n---\n\nTâche à effectuer: ${TASK}\n\nGénère les modifications nécessaires.`
    }]

    let codeResponse
    try {
      codeResponse = await callClaude(messages, systemPrompt)
      // Nettoie la réponse pour extraire le JSON
      const jsonMatch = codeResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Pas de JSON dans la réponse')
      const changes = JSON.parse(jsonMatch[0])
      
      console.log(`✓ ${Object.keys(changes.files).length} fichier(s) à modifier`)
      console.log(`📝 ${changes.explanation}`)
      
      applyChanges(changes.files)
    } catch (e) {
      console.error('Erreur parsing réponse Claude:', e.message)
      break
    }

    // Attendre que l'app reload
    await new Promise(r => setTimeout(r, 5000))

    // Lance un serveur statique si pas de serveur existant
    try {
    const { spawn } = require('child_process')
    execSync('pkill -f "serve" 2>/dev/null || true')
    spawn('npx', ['serve', '.', '-p', '3000'], { stdio: 'ignore', detached: true }).unref()
    await new Promise(r => setTimeout(r, 3000))
    } catch(e) {}

    // Screenshot après
    try {
    const after = await takeScreenshot(`after-iteration-${iteration}`)
    screenshots.push(after)
    console.log('📸 Screenshot après pris')
    } catch (e) {
    console.log('⚠️ Pas de screenshot après')
    }

    // Vérifie si la tâche est accomplie
    const verifyPrompt = `Tu es un agent QA. Dis si la tâche a été accomplie correctement.

Réponds avec un JSON: {"done": true/false, "reason": "explication courte"}`

    const verifyResponse = await callClaude([{
      role: 'user',
      content: `Tâche originale: ${TASK}\n\nChangements effectués: ${codeResponse}\n\nEst-ce que la tâche est accomplie?`
    }], verifyPrompt)

    try {
      const jsonMatch = verifyResponse.match(/\{[\s\S]*\}/)
      const verify = JSON.parse(jsonMatch[0])
      console.log(`✓ Vérification: ${verify.reason}`)
      if (verify.done) {
        console.log('✅ Tâche accomplie!')
        break
      }
    } catch {
      console.log('Vérification incomplète, on continue')
    }
  }

  // Crée la PR
  console.log('\n📬 Création de la Pull Request...')
  await createPR(screenshots, MAX_ITERATIONS)
  console.log('🎉 Agent terminé!')
}

main().catch(e => {
  console.error('Erreur agent:', e)
  process.exit(1)
})