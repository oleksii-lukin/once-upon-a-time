export function mdToHtml(md: string): string {
  const lines = md.split('\n')
  const html: string[] = []
  let inList = false
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.startsWith('### ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const title = line.slice(4)
      html.push(`<h3 class="text-xl font-bold text-amber-400 mb-3 mt-6 border-l-4 border-amber-400 pl-3">${title}</h3>`)
    }
    else if (line.startsWith('## ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const title = line.slice(3)
      html.push(`<h2 class="text-2xl font-bold text-purple-400 mb-4 mt-8 flex items-center"><span class="w-8 h-8 bg-purple-400 text-gray-900 rounded-full flex items-center justify-center mr-3 text-sm font-bold">§</span>${title}</h2>`)
    }
    else if (line.startsWith('# ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const title = line.slice(2)
      html.push(`<h1 class="text-5xl font-bold text-center mb-8 mt-4 bg-linear-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent drop-shadow-lg">${title}</h1>`)
    }
    else if (line.startsWith('- ')) {
      if (!inList) {
        html.push('<ul class="space-y-2 mb-4">')
        inList = true
      }
      const item = line.slice(2)
      // Highlight bold text within list items
      const processedItem = item.replace(/\*\*(.*?)\*\*/g, '<span class="text-cyan-400 font-semibold">$1</span>')
      html.push(`<li class="flex items-start"><span class="text-green-400 mr-2 mt-1">▸</span><span class="text-gray-200">${processedItem}</span></li>`)
    }
    else if (line === '') {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push('<br class="mb-4">')
    }
    else {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      // Process bold text and add styling to paragraphs
      let processedLine = line
        .replace(/\*\*(.*?)\*\*/g, '<span class="text-cyan-400 font-semibold">$1</span>')
        .replace(/(\d+\.\s)/g, '<span class="text-purple-400 font-bold mr-2">$1</span>')
      
      html.push(`<p class="text-gray-200 mb-4 leading-relaxed">${processedLine}</p>`)
    }
  }
  if (inList) {
    html.push('</ul>')
  }
  return html.join('\n')
}
