import * as vscode from 'vscode'
import * as path from 'path'

import { PrismFileSystem, PrismPath } from './PrismFileManager'

const linkPattern = /\[\[1\+1\=([^\]]+?)\]\]/g

function getCodeSnippetFileFullName(fileName: string) {
  return path.join(PrismPath.getPrismSnippetFolderPath(), fileName + '.snippet.txt')
}

/**
 * Creates a code snippet file with the given file name and code content.
 *
 * @param fileName - The name of the file to be created (without extension).
 * @param code - The code content to be written into the file.
 */
export function createCodeSnippetFile(fileName: string, code: string) {
  PrismFileSystem.createFile(getCodeSnippetFileFullName(fileName), code)
}

/**
 * Activates the link detector functionality for the VS Code extension.
 *
 * This function registers the `DocumentLinkProvider` and `HoverProvider` for all file types.
 * It adds these providers to the extension's subscriptions, ensuring they are disposed of when the extension is deactivated.
 *
 * @param context - The extension context provided by VS Code, used to register the providers.
 */
export async function oneplusone_activate(context: vscode.ExtensionContext) {
  // Create a TextEditorDecorationType that underlines text and changes its color
  const linkDecoration = vscode.window.createTextEditorDecorationType({
    textDecoration: 'underline',
    color: '#e5e51a',
  })

  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      { language: '*' },
      {
        provideDocumentLinks(
          document: vscode.TextDocument,
          token: vscode.CancellationToken
        ): vscode.ProviderResult<vscode.DocumentLink[]> {
          // Get the text of the document
          const text = document.getText()
          const links = []
          const decos = []
          let match
          // Find all matches of the regular expression in the text
          while ((match = linkPattern.exec(text))) {
            // Get the start and end positions of the description
            const descStart = document.positionAt(match.index)
            const descEnd = document.positionAt(match.index + match[0].length)
            const range = new vscode.Range(descStart, descEnd)

            // Create a DocumentLink for the match
            const file = getCodeSnippetFileFullName(match[1])
            const link = new vscode.DocumentLink(range, vscode.Uri.file(file))
            links.push(link)
            decos.push(range)
          }

          // Underline the links in the active text editor
          if (vscode.window.activeTextEditor) {
            vscode.window.activeTextEditor.setDecorations(linkDecoration, decos)
          }

          // Return the links
          return links
        },
      }
    )
  )
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('*', {
      provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
      ): vscode.ProviderResult<vscode.Hover> {
        // Get the range of the word at the position where the hover was invoked
        const range = document.getWordRangeAtPosition(position, linkPattern)
        if (range) {
          // Get the text of the word
          const linkText = document.getText(range)

          // Extract the filename from the match
          const fileName = linkText.replace('[[1+1=', '').replace(']]', '')
          const fullName = getCodeSnippetFileFullName(fileName)

          const title = '🔗 Show code snippet (by Code Prism)'
          // <div> 태그에서 보면 \n이 사용되는데 이건 # title로 시작하는 markdown을 인식되게 하기 위한 것이다.
          const markdown = `${title} <div>\n${PrismFileSystem.getDocContent(fullName, -1)}</div>`
          const markdownString = new vscode.MarkdownString(markdown)
          return new vscode.Hover(markdownString)
        }
      },
    })
  )
}
