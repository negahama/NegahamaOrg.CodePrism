import * as vscode from 'vscode'
import { parse } from 'path'
import { PrismFileManager } from './PrismFileManager'

// [concept](doc/concept.md) 참고
// [linker](doc/linker.md) 참고

/**
 * Represents information about a link within the code.
 */
interface LinkInfo {
  description: string
  fileName: string
  fragment: string
}

const linkPattern = /\[[^\]]+\]\([^\)]+\)/g

/**
 * Parses a link from the given text and document path.
 *
 * This function extracts the description and path from the provided text,
 * processes the path to handle query and fragment components, and resolves
 * the path to an absolute path if necessary.
 *
 * @param text - The text containing the link to be parsed. The link should be in the format `[description](path)`.
 * @param documentPath - The path of the document containing the link. This is used to resolve relative paths.
 * @returns An object containing the description, fileName, and fragment of the link, or `null` if the link could not be parsed.
 *
 * @remarks
 * - The path can be an absolute path, a relative path, or a workspace path.
 * - Absolute paths start with `file:///`, relative paths start with `./`, and other paths are considered workspace paths.
 * - The function ensures that the path uses forward slashes (`/`) instead of backslashes (`\`).
 *
 * @example
 * ```typescript
 * const linkInfo = parseLink("[description](./path/to/file.md)", "/d:/Samuel/NegahamaOrg.CodePrism/src/code-prism/PrismLinkProvider.ts");
 * if (linkInfo) {
 *   console.log(linkInfo.description); // Outputs: description
 *   console.log(linkInfo.fileName);    // Outputs: /d:/Samuel/NegahamaOrg.CodePrism/src/code-prism/path/to/file.md
 *   console.log(linkInfo.fragment);    // Outputs: (fragment if any)
 * }
 * ```
 */
function parseLink(text: string, documentPath: string): LinkInfo | null {
  // Extract the description and the path from the match
  const descMatch = text.match(/\[(.*?)\]/)
  const pathMatch = text.match(/\((.*?)\)/)
  if (descMatch && pathMatch) {
    let desc = descMatch[0]
    let path = pathMatch[1]

    // uri를 파싱할때 아래와 같이 uri.toString()을 사용하면 query와 fragment를 추출할 수 없다.
    // uri.toString()을 사용하면 file:///d%3A/Users/.../filename.md%23L52-L54 이런식으로 반환되기 때문에 문제가 되는 것 같다.
    // 이 패스에서 ?query 와 #fragment를 추출한다.
    const { fragment } = vscode.Uri.parse(path)

    // 추출한 후 패스에서 query와 fragment를 제거한다.
    path = path.replace(/\?.*$/, '').replace(/#.*/, '')

    // path는 절대경로, 상대경로, 워크스페이스 경로가 될 수 있다.
    // 절대경로는 file:///로 시작하고 상대경로는 ./로 시작한다. 그외는 워크스페이스 경로로 간주한다.
    // If the path is not absolute, make it relative to the workspace folder
    if (path.startsWith('file:///')) {
      // do nothing
    } else if (path.startsWith('./')) {
      const dir = parse(documentPath).dir
      path = vscode.Uri.joinPath(vscode.Uri.file(dir), path).fsPath
    } else {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (workspaceFolder) {
        path = vscode.Uri.joinPath(workspaceFolder.uri, path).fsPath
      }
    }

    // 이 과정이 꼭 필요하다.
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
 * Provides document links for a text document using Prism syntax.
 *
 * This class implements the `vscode.DocumentLinkProvider` interface and is responsible for
 * identifying and creating document links within a text document. It uses a regular expression
 * to find links in the form `[description](path)` and converts them into `vscode.DocumentLink` objects.
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
export class PrismLinkProvider implements vscode.DocumentLinkProvider {
  // Create a TextEditorDecorationType that underlines text and changes its color
  linkDecoration = vscode.window.createTextEditorDecorationType({
    textDecoration: 'underline',
    color: '#61AFEF',
  })

  /**
   * The provideDocumentLinks method is called when VS Code needs to get the document links for a text document
   *
   * @param document
   * @param token
   * @returns
   */
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
        vscode.Uri.from({
          ...vscode.Uri.file(result.fileName),
          // query: url.query,
          fragment: result.fragment,
        })
      )
      links.push(link)
      decos.push(range)
    }

    // Underline the links in the active text editor
    if (vscode.window.activeTextEditor) {
      vscode.window.activeTextEditor.setDecorations(this.linkDecoration, decos)
    }

    // Return the links
    return links
  }
}

/**
 * Provides hover information for Markdown-style links in a text document.
 *
 * This class implements the `vscode.HoverProvider` interface and is used to
 * show hover information for links in the format `[description](path)`.
 * When the user hovers over such a link, a hover tooltip will be displayed
 * with the link description and a clickable link to the specified path.
 *
 * @implements {vscode.HoverProvider}
 *
 * @method provideHover
 * @param {vscode.TextDocument} document - The text document in which the hover was invoked.
 * @param {vscode.Position} position - The position at which the hover was invoked.
 * @param {vscode.CancellationToken} token - A cancellation token.
 * @returns {vscode.ProviderResult<vscode.Hover>} A hover object containing the Markdown string with the link.
 */
export class PrismLinkHoverProvider implements vscode.HoverProvider {
  /**
   * The provideHover method is called when VS Code needs to show a hover
   *
   * @param document
   * @param position
   * @param token
   * @returns
   */
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

      // Extract the description and the path from the match
      const result = parseLink(linkText, document.uri.fsPath)
      if (!result) {
        return
      }

      // 아래 코드는 마크다운 프리뷰를 오픈하는 명령을 링크해 두는 방법이다.
      // 이 코드가 정상적으로 동작하기 위해서는 명령의 쿼리로 인코딩된 인수를 전달해야 하는데
      // 인코딩 전에 JSON.stringify()를 사용하여 인코딩해야 하며 이때 args로 Uri 개체 자체가
      // 배열로 전달되어야 한다.
      // [concept](doc/concept.md) 참고
      // [linker](doc/linker.md) 참고

      // 프리뷰의 인수로 전달되는 uri는 fragment를 포함할 수 없다.
      // markdown 문서인 경우에는 markdown 프리뷰를 오픈하고 그렇지 않은 경우에는 문서를 바로 표시한다.
      if (result.fileName.endsWith('.md')) {
        const uri = vscode.Uri.file(result.fileName)
        const args = [uri]
        const commandId = 'markdown.showPreviewToSide'
        // const commandId = 'CodePrism.command.showMarkdownPreviewToSide'
        const encodedArgs = encodeURIComponent(JSON.stringify(args))
        const openCommandUri = vscode.Uri.parse(`command:${commandId}?${encodedArgs}`)
        // <div> 태그에서 보면 \n이 사용되는데 이건 # title로 시작하는 markdown을 인식되게 하기 위한 것이다.
        const markdownString = new vscode.MarkdownString(
          `[🔗 Open document](${openCommandUri}) <div>\n${this.getDocContent(result.fileName)}</div>`
        )
        markdownString.supportHtml = true
        markdownString.isTrusted = true

        // Return a Hover
        return new vscode.Hover(markdownString)
      } else {
        // 아래 코드는 마크다운 링크를 표시한다.
        // 링크를 클릭해서 정상적으로 파일이 오픈되게 하려면 링크에 file scheme이 필요하다.
        // Create a MarkdownString for the hover
        const markdownString = new vscode.MarkdownString(
          `[${result.description}](file:///${result.fileName}) <div>\n${this.getDocContent(result.fileName)}</div>`
        )
        markdownString.supportHtml = true
        markdownString.isTrusted = true

        // Return a Hover
        return new vscode.Hover(markdownString)
      }
    }
  }

  /**
   * Retrieves the content of a specified file and formats it for display.
   * 링크된 uri에 fragment가 포함되어 있으면 오픈할 파일명으로 적절하지 않기 때문에 이를 제거하는데 이미 그렇게 오고 있다.
   * markdown 문서가 아니면 코드로 표시한다.
   *
   * @param fileName - The name of the file to read content from.
   * @returns A string containing the formatted content of the file. If the file has more than 10 lines,
   *          only the first 10 lines are included followed by a '`... <more>`' indicator. If the file
   *          extension is not 'md', the content is wrapped in code block markers.
   * @throws Will log an error to the console if there is an issue reading the file.
   */
  getDocContent(fileName: string): string {
    let content: string = '# No content'
    try {
      const data = PrismFileManager.readFile(fileName)
      let lines = data.split('\n')
      if (lines.length > 10) {
        lines = lines.slice(0, 10)
        lines.push('`... <more>`')
      }
      content = lines.join('\n')

      const ext = fileName.split('.').pop()
      if (ext !== 'md') {
        content = '\n```\n' + content + '\n```\n'
      }
    } catch (error) {
      console.error(error)
    }
    return content
  }
}
