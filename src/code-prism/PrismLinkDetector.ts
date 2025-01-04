import * as vscode from 'vscode'
import { parse } from 'path'

import { PrismFileSystem } from './PrismFileSystem'

// [linker](/doc/linker.md) 참고
export namespace PrismLinkDetector {
  /**
   * Represents information about a link within the code.
   */
  interface LinkInfo {
    description: string
    fileName: string
    fragment: string
  }

  /**
   * A regular expression pattern to detect markdown links.
   * The pattern matches strings that follow the markdown link syntax:
   * [link text](URL)
   */
  const linkPattern = /\[[^\]]+\]\([^\)]+\)/g

  /**
   * Converts markdown-style links in the given text to absolute paths.
   *
   * This function searches for links in the format `[description](path)` within the provided text,
   * parses them, and replaces them with links that have absolute paths.
   *
   * @param text - The input text containing markdown-style links.
   * @returns The text with converted links.
   */
  export function convertLink(text: string) {
    // text에서 [description](path) 형식의 링크를 찾아 절대 경로로 변환한 후 반환한다.
    let match
    while ((match = linkPattern.exec(text))) {
      const linkInfo = parseLink(match[0], '')
      if (!linkInfo) {
        continue
      }
      // parseLink에서 리턴되는 description은 []로 감싸져 있으므로 그대로 사용한다.
      // 하지만 fileName에는 `file:///`가 포함되어 있지 않기 때문에 추가해야 한다.
      // 또한 fragment가 포함되어 있으면 이것도 추가해야 한다.
      const pathText = linkInfo.fragment ? `${linkInfo.fileName}#${linkInfo.fragment}` : linkInfo.fileName
      const linkText = `${linkInfo.description}(file:///${pathText})`
      text = text.replace(match[0], linkText)
    }
    return text
  }

  /**
   * Parses a link from the given text and document path.
   *
   * This function extracts the description and path from the provided text,
   * processes the path to handle query and fragment components, and resolves
   * the path to an absolute path if necessary.
   *
   * @param text - The text containing the link to be parsed. The link should be in the format `[description](path)`.
   * @param documentPath - The path of the document. This is used to resolve relative paths.
   * @returns An object containing the description, fileName, and fragment of the link, or `null` if the link could not be parsed.
   *
   * @remarks
   * - The path can be an absolute path, a relative path, or a workspace path.
   * - Absolute paths start with `file:///`, relative paths start with `./`, and workspace path starts with `/`.
   * - The function ensures that the path uses forward slashes (`/`) instead of backslashes (`\`).
   *
   * uri를 파싱할때 uri.toString()을 사용하면 `file:///d%3A/Users/.../filename.md%23L52-L54` 이런식으로 반환되는데
   * 이것으로 query와 fragment를 추출할 수 없다.
   * 즉 'text'는 uri.fsPath를 사용해야 한다.
   *
   * @example
   * ```typescript
   * const linkInfo = parseLink("[description](./path/to/file.md#10-20)", document.uri.fsPath);
   * if (linkInfo) {
   *   console.log(linkInfo.description); // Outputs: description
   *   console.log(linkInfo.fileName);    // Outputs: <document.uri.fsPash>/path/to/file.md
   *   console.log(linkInfo.fragment);    // Outputs: #10-20
   * }
   * ```
   */
  export function parseLink(text: string, documentPath: string): LinkInfo | null {
    // Extract the description and the path from the match
    const descMatch = text.match(/\[(.*?)\]/)
    const pathMatch = text.match(/\((.*?)\)/)
    if (descMatch && pathMatch) {
      let desc = descMatch[0]
      let path = pathMatch[1]

      // The path can be an absolute path, a relative path, or a workspace path.
      // Absolute paths start with file:///, relative paths start with ./, and workspace paths start with /.
      // All paths are converted to absolute paths. If the path starts with file:///, remove it (it will be included again later)
      // 상대 경로는 같이 전달된 documentPath를 기준으로 절대 경로로 변환한다.
      if (path.startsWith('file:///')) {
        path = path.replace('file:///', '')
      } else if (path.startsWith('./')) {
        const dir = parse(documentPath).dir
        path = vscode.Uri.joinPath(vscode.Uri.file(dir), path).fsPath
      } else if (path.startsWith('/')) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (workspaceFolder) {
          path = vscode.Uri.joinPath(workspaceFolder.uri, path).fsPath
        }
      } else {
        return null
      }

      // Extract ?query and #fragment from this path.
      const { fragment } = vscode.Uri.parse(path)

      // After extracting, remove the query and fragment from the path.
      path = path.replace(/\?.*$/, '').replace(/#.*/, '')

      // This step is necessary.
      path = path.replace(/\\/g, '/')

      return {
        description: desc,
        fileName: path,
        fragment,
      }
    }
    return null
  }

  /**
   * Activates the link detector functionality for the VS Code extension.
   *
   * This function registers the `DocumentLinkProvider` and `HoverProvider` for all file types.
   * It adds these providers to the extension's subscriptions, ensuring they are disposed of when the extension is deactivated.
   *
   * @param context - The extension context provided by VS Code, used to register the providers.
   */
  export async function activate(context: vscode.ExtensionContext) {
    // Create a TextEditorDecorationType that underlines text and changes its color
    const linkDecoration = vscode.window.createTextEditorDecorationType({
      textDecoration: 'underline',
      color: '#e5e51a',
    })

    /**
     * Provides document links for a text document in VS Code.
     * This class implements the `vscode.DocumentLinkProvider` interface.
     * It identifies links in the form `[description](path)` within the document
     * and creates `vscode.DocumentLink` objects for them.
     * Additionally, it underlines the links in the active text editor.
     *
     * @implements {vscode.DocumentLinkProvider}
     *
     * @method provideDocumentLinks
     * @param {vscode.TextDocument} document - The text document for which to provide links.
     * @param {vscode.CancellationToken} token - A cancellation token.
     * @returns {vscode.ProviderResult<vscode.DocumentLink[]>} An array of `vscode.DocumentLink` objects.
     *
     * The `provideDocumentLinks` method performs the following steps:
     * 1. Retrieves the text of the document.
     * 2. Defines a regular expression to match links in the form `[description](path)`.
     * 3. Finds all matches of the regular expression in the text.
     * 4. Extracts the description and path from each match.
     * 5. Parses the path to extract query and fragment components, if any.
     * 6. Adjusts the path to be relative to the workspace folder if it is not absolute.
     * 7. Creates a `vscode.DocumentLink` for each match and adds it to the links array.
     * 8. Underlines the links in the active text editor.
     * 9. Returns the array of `vscode.DocumentLink` objects.
     */
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

            // Define a regular expression that matches links in the form [description](path)
            const links = []
            const decos = []
            let match

            // Find all matches of the regular expression in the text
            while ((match = linkPattern.exec(text))) {
              // Extract the description and the path from the match
              const result = parseLink(match[0], document.uri.fsPath)
              if (!result) {
                continue
              }

              // Get the start and end positions of the description
              const descStart = document.positionAt(match.index + 1) // 1 is for '['
              const descEnd = document.positionAt(match.index + result.description.length - 1) // -1 is for ']'
              const range = new vscode.Range(descStart, descEnd)

              // Create a DocumentLink for the match
              // const link = new vscode.DocumentLink(range, vscode.Uri.file(path))
              const link = new vscode.DocumentLink(
                range,
                vscode.Uri.file(result.fileName).with({ fragment: result.fragment })
              )
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

    /**
     * Provides hover information for Markdown-style links in a text document.
     *
     * This class implements the `vscode.HoverProvider` interface and is used to
     * show hover information for links in the format `[description](path)`.
     * When the user hovers over such a link, a hover tooltip will be displayed
     * with the link description and a clickable link to the specified path.
     *
     * 기본 동작은 링크되어진 문서를 읽어 그 내용을 표시해 주고 해당 문서를 오픈할 수 있는 링크를 tooltip 상에서 제공하는 것이다.
     *
     * @implements {vscode.HoverProvider}
     *
     * @method provideHover
     * @param {vscode.TextDocument} document - The text document in which the hover was invoked.
     * @param {vscode.Position} position - The position at which the hover was invoked.
     * @param {vscode.CancellationToken} token - A cancellation token.
     * @returns {vscode.ProviderResult<vscode.Hover>} A hover object containing the Markdown string with the link.
     */
    context.subscriptions.push(
      vscode.languages.registerHoverProvider('*', {
        async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
          // Get the range of the word at the position where the hover was invoked
          const range = document.getWordRangeAtPosition(position, linkPattern)
          if (range) {
            // Get the text of the word
            const linkText = document.getText(range)

            // Extract the description and the path from the match
            const result = parseLink(linkText, document.uri.fsPath)
            if (!result) {
              return
            }

            const uri = vscode.Uri.file(result.fileName).with({ fragment: result.fragment })
            const content = await PrismFileSystem.getDocContent(uri)

            let link: string = ''
            if (result.fileName.endsWith('.md')) {
              // 링크되어진 markdown 문서의 일부를 tooltip에 표시한다.
              // 이때 툴팁에 링크 하나가 제공되는데 이 링크를 클릭하면 해당 markdown 문서의 preview가 오픈된다.
              // 아래 코드는 command uri를 이용하여 markdown preview를 오픈하는 명령을 링크해 두는 방법이다.
              // 이 코드가 정상적으로 동작하기 위해서는 명령의 쿼리로 인코딩된 인수를 전달해야 하는데
              // 인코딩 전에 JSON.stringify()를 사용하여 인코딩해야 하며 이때 args로 Uri 개체 자체가
              // 배열로 전달되어야 한다.
              // 프리뷰의 인수로 전달되는 uri는 fragment를 포함할 수 없다.
              // [concept](/doc/concept.md) 참고
              const args = [uri]
              const commandId = 'markdown.showPreviewToSide'
              const encodedArgs = encodeURIComponent(JSON.stringify(args))
              const openCommandUri = vscode.Uri.parse(`command:${commandId}?${encodedArgs}`)
              link = `${openCommandUri}`
            } else {
              // markdown 문서가 아닌 경우에는 코드로 표시한다.
              // markdown 문서는 tooltip에서 open document 링크를 클릭하면 preview가 오픈되지만
              // 나머지 파일은 링크를 클릭하면 그냥 해당 파일을 오픈한다. 이 과정은 별도의 command로 처리될 필요가 없다.
              // 대신 링크를 클릭해서 정상적으로 파일이 오픈되게 하려면 링크에 file scheme이 필요하다.
              // 그리고 fragment를 포함시킨다.
              link = `file:///${result.fileName}#${result.fragment}`
            }

            // <div> 태그 시작과 끝부분에 보면 \n이 사용되고 있다.
            // 앞부분의 \n은 # title로 시작하는 markdown을 인식되게 하기 위한 것이다.
            // 뒷부분의 \n은 ```으로 끝나는 경우 </div>까지 markdown의 일부로 인식되지 않게 하기 위해서이다.
            const linkTitle = '🔗 Open linked document (by Code Prism)'
            const markdown = `[${linkTitle}](${link}) <div>\n${content}\n</div>`

            const markdownString = new vscode.MarkdownString(markdown)
            markdownString.supportHtml = true
            markdownString.isTrusted = true

            // Return a Hover
            return new vscode.Hover(markdownString)
          }
        },
      })
    )
  }
}
