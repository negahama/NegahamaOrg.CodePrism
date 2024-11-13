import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

import { uuid } from './Prism'
import { PrismPath } from './PrismPath'
import { PrismManager } from './PrismManager'
import { PrismFileSystem } from './PrismFileSystem'

export namespace PrismAdaptiveLinkDetector {
  /**
   * Regular expression pattern for matching adaptive links.
   */
  const linkPattern = /\[\[al\=([^\]]+?)\]\]/g

  /**
   * Represents information about a link within a file.
   *
   * @interface LinkInfo
   * @property {string} fileName - The name of the file containing the link.
   * @property {number} startLine - The starting line number of the link.
   * @property {number} endLine - The ending line number of the link.
   */
  interface LinkInfo {
    fileName: string
    startLine: number
    endLine: number
  }

  /**
   * A map that associates a string key with a LinkInfo object.
   * This map is used to store and retrieve link information.
   */
  const linkMap: Map<string, LinkInfo> = new Map()

  /**
   * Retrieves the full file path for the adaptive link file.
   *
   * This function constructs the full path to the 'adaptive-link.txt' file
   * located within the Prism snippet folder. It uses the `PrismPath.getPrismSnippetFolderPath()`
   * method to get the base folder path and then joins it with the file name.
   *
   * @returns {string} The full file path to the 'adaptive-link.txt' file.
   */
  function getAdaptiveLinkFileFullName() {
    const folderPath = PrismPath.getPrismSnippetFolderPath()
    return path.join(folderPath, 'adaptive-link.txt')
  }

  /**
   * Reads the adaptive link file and processes its contents.
   *
   * This function performs the following steps:
   * 1. Retrieves the full name of the adaptive link file.
   * 2. Checks if the file exists. If it does not, it creates and saves a new adaptive link file.
   * 3. Reads the contents of the file.
   * 4. Splits the file data by lines and processes each line.
   * 5. For each line, splits it by commas and appends a link using the extracted tokens.
   *
   * The expected format of each line in the file is: `token0,token1,token2,token3`
   * where `token2` and `token3` are expected to be integers.
   */
  function readAdaptiveLinkFile() {
    const file = getAdaptiveLinkFileFullName()
    if (!fs.existsSync(file)) {
      saveAdaptiveLinkFile()
    }

    const data = PrismFileSystem.readFile(file)
    if (!data) {
      return
    }

    data.split('\n').forEach(line => {
      if (!line || !line.trim()) {
        return
      }
      const tokens = line.split(',')
      appendLink(tokens[0], tokens[1], parseInt(tokens[2]), parseInt(tokens[3]))
    })
  }

  /**
   * Saves the adaptive link data to a file. The data is collected from the `linkMap`
   * and written to a file in CSV format. Each entry in the `linkMap` is written as a
   * line in the file with the format: `key,fileName,startLine,endLine`.
   *
   * The file is saved using the `PrismFileSystem.saveFile` method.
   */
  function saveAdaptiveLinkFile() {
    let contents = ''
    linkMap.forEach((value, key) => {
      contents += `${key},${value.fileName},${value.startLine},${value.endLine}\n`
    })

    const file = getAdaptiveLinkFileFullName()
    PrismFileSystem.saveFile(file, contents)
  }

  /**
   * Appends or updates a link in the `linkMap` with the provided name, path, start line, and end line.
   *
   * @param name - The name of the link to append or update.
   * @param path - The file path associated with the link.
   * @param startLine - The starting line number of the link.
   * @param endLine - The ending line number of the link.
   */
  function appendLink(name: string, path: string, startLine: number, endLine: number) {
    const info = {
      fileName: path,
      startLine,
      endLine,
    }

    if (!linkMap.has(name)) {
      linkMap.set(name, info)
    } else {
      const link = linkMap.get(name)
      if (link) {
        link.fileName = path
        link.startLine = startLine
        link.endLine = endLine
      }
    }
  }

  /**
   * Activates the extension.
   *
   * @param context - The extension context provided by VS Code.
   *
   * This function performs the following tasks:
   * - Creates a TextEditorDecorationType to underline text and change its color.
   * - Reads the adaptive link file.
   * - Registers an event listener for text document changes.
   * - Registers a command to copy an adaptive link to the clipboard.
   * - Registers a document link provider to detect and create document links.
   * - Registers a hover provider to show a hover with code snippet information.
   */
  export async function activate(context: vscode.ExtensionContext) {
    // Create a TextEditorDecorationType that underlines text and changes its color
    const linkDecoration = vscode.window.createTextEditorDecorationType({
      textDecoration: 'underline',
      color: '#e5e51a',
    })

    readAdaptiveLinkFile()

    // 종료 시에만 저장한다
    context.subscriptions.push({
      dispose: () => {
        saveAdaptiveLinkFile()
      },
    })

    vscode.workspace.onDidChangeTextDocument(changeEvent => {
      let founds: LinkInfo[] = []
      linkMap.forEach(value => {
        if (value.fileName === changeEvent.document.fileName) {
          founds.push(value)
        }
      })

      if (!founds.length) {
        return
      }

      let needUpdate = false
      changeEvent.contentChanges.forEach(change => {
        const line1 = change.range.start.line
        const line2 = change.range.end.line

        let lineCount = 0
        if (change.text.length === 0 && change.rangeLength === 0) {
          // select만 해도 발생한다. 이 경우는 처리하지 않는다.
          return
        } else if (change.text.length > 0 && change.rangeLength === 0) {
          // 텍스트가 추가되었을 때 (change.text는 추된 텍스트)
          // 텍스트 추가인 경우에도 라인이 추가되는 경우가 아니면 처리하지 않는다.
          if (!change.text.includes('\n')) {
            return
          }

          const matchResult = change.text.match(/\n/g)
          lineCount = matchResult ? matchResult.filter(item => item !== '').length : 0
        } else if (change.text.length === 0 && change.rangeLength > 0) {
          // 텍스트가 삭제되었을 때 (rangeLength는 삭제된 텍스트의 길이)
          lineCount = -(line2 - line1)
        } else {
          // 이 경우는 선택되어진 텍스트를 변경할때나 JSDoc 주석을 추가하는 경우등에 발생한다.
          // 라인이 추가될 수도 있고 삭제될 수도 있다.
          // 원래 텍스트의 라인 수와 변경된 텍스트의 라인 수를 비교한다.
          const deletedLineCount = line2 - line1
          const matchResult = change.text.match(/\n/g)
          const insertedLineCount = matchResult ? matchResult.filter(item => item !== '').length : 0
          lineCount = insertedLineCount - deletedLineCount
        }

        if (lineCount === 0) {
          return
        }

        founds.forEach(link => {
          let newLineCount = 0
          if (lineCount < 0) {
            if (line2 < link.endLine - 1) {
              // 삭제된 텍스트의 위치가 link.endLine보다 위에 있으면 lineCount만큼 올린다
              newLineCount = lineCount
            } else if (line1 >= link.endLine - 1) {
              // 삭제된 텍스트의 위치가 link.endLine보다 아래에 있으면 위치를 유지한다.
            } else if (line1 < link.endLine - 1 && link.endLine - 1 <= line2) {
              // 삭제된 텍스트가 link.endLine과 겹치면 전체 삭제된 라인만큼 위로 이동하는 것이 아니라
              // 원래 위치의 윗부분에서 삭제된 라인만큼만 반영되어야 한다.
              newLineCount = -(link.endLine - line1 - 1)
            } else {
              console.warn('another case')
            }
          } else {
            // 추가된 텍스트의 위치가 link.endLine보다 위에 있으면 lineCount만큼 내린다
            // link.endLine보다 아래에 있으면 현재 위치를 유지하고 이 두 경우는 정상적인 동작이다.
            // 문제는 추가된 텍스트의 위치가 link.endLine가 같은 위치인 경우인데 이 경우는 상황에 따라서
            // 현재 위치를 유지하는 것이 맞을 수도 있고 내리는 것이 맞을 수도 있다. 현재 위치의 내용이 변경되지 않고
            // 텍스트가 추가만 되어진 경우에는 아래로 내리는 것이 맞지만 commentController 자체가 그렇게 동작하지 않기 때문에
            // 일단 현재 위치를 유지하는 것으로 해서 commentController와 동일하게 동작하게 한다.
            if (link.endLine - 1 > line1) {
              newLineCount = lineCount
            }
          }
          if (newLineCount !== 0) {
            link.startLine += newLineCount
            link.endLine += newLineCount
            needUpdate = true
          }
        })
      })

      // 종료 시에만 저장한다
      // if (needUpdate) {
      //   saveAdaptiveLinkFile()
      // }
    })

    context.subscriptions.push(
      vscode.commands.registerCommand('CodePrism.command.CopyAdaptiveLink', () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) {
          return
        }

        const { code, range, path: path2 } = PrismManager.getCodeWithRangeAndPath(editor)

        const name = uuid()
        const link = `[[al=${name}]]`
        vscode.env.clipboard.writeText(link)

        appendLink(name, path.join(PrismPath.getWorkspacePath(), path2), range.start.line + 1, range.end.line + 1)
        // 종료 시에만 저장한다
        // saveAdaptiveLinkFile()
      })
    )

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
              const info = linkMap.get(match[1])
              if (!info) {
                continue
              }

              const file = vscode.Uri.from({
                ...vscode.Uri.file(info.fileName),
                fragment: `${info.startLine}-${info.endLine}`,
              })

              const link = new vscode.DocumentLink(range, file)
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
            let match = linkPattern.exec(linkText)
            if (!match) {
              return
            }

            // Create a DocumentLink for the match
            const info = linkMap.get(match[1])
            if (!info) {
              return
            }

            const content = PrismFileSystem.getDocContent(
              vscode.Uri.from({
                ...vscode.Uri.file(info.fileName),
                fragment: `${info.startLine}-${info.endLine}`,
              })
            )

            // [[al=b930919781f46cfb8bd787d7abd05731]]
            const title = '🔗 Show code snippet (by Code Prism)'
            const markdown = `${title} <div>\n${content}\n</div>`
            const markdownString = new vscode.MarkdownString(markdown)
            return new vscode.Hover(markdownString)
          }
        },
      })
    )
  }
}
