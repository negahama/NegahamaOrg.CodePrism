import * as vscode from 'vscode'
import { marked } from 'marked'
import Prism from 'prismjs'
import loadLanguages from 'prismjs/components/'

/**
 * The `DefinitionViewRenderer` class is responsible for rendering code definitions and managing resources.
 * It utilizes a `CodeHighlighter` to highlight code and handles the disposal of resources.
 *
 * @class
 * @method constructor - Initializes a new instance of the `DefinitionViewRenderer` class.
 * @method dispose - Disposes of all resources managed by the `DefinitionViewRenderer`.
 * @method renderDefinitions - Retrieves and concatenates text from specified locations within files.
 * @method getFileContents - Retrieves the contents of a file within a specified range, including relevant preceding lines and extending to the end of the function or block.
 */
export class DefinitionViewRenderer {
  private readonly disposables: vscode.Disposable[] = []

  constructor() {
    // 사용할 계획이 있는 언어들을 불러온다.
    // 지원하는 모든 언어는 https://prismjs.com/#supported-languages 에서 확인
    loadLanguages(['typescript'])

    const renderer = new marked.Renderer()

    // 코드블럭 렌더링
    renderer.code = ({ text, lang, escaped }): string => {
      if (lang === undefined) {
        return `<pre><code>${text}</code></pre>`
      }
      const grammar = Prism.languages[lang]
      return `<pre><code class="language-${lang}">${Prism.highlight(text, grammar, lang)}</code></pre>`
    }

    marked.use({ renderer })
  }

  dispose() {
    let item: vscode.Disposable | undefined
    while ((item = this.disposables.pop())) {
      item.dispose()
    }
  }

  /**
   * Converts a given markdown string to HTML.
   *
   * This method uses the `marked` library to render the markdown content into HTML.
   * It logs the rendered HTML to the console before returning it.
   *
   * @param markdown - The markdown string to be converted.
   * @returns A promise that resolves to the rendered HTML string.
   */
  async render(markdown: string) {
    // // 간단한 마크다운 변환기
    // let html = markdown
    //   .replace(/^# (.*$)/gim, '<h1>$1</h1>') // 제목
    //   .replace(/^\*\*(.*)\*\*/gim, '<b>$1</b>') // 굵은 텍스트
    //   .replace(/^\*(.*)\*/gim, '<i>$1</i>') // 기울임 텍스트
    //   .replace(/```(.*?)```/gims, '<pre><code>$1</code></pre>') // 코드 블록
    //   .replace(/\n$/gim, '<br />') // 줄바꿈

    // return html

    // return await marked.parse(markdown, {})
    return await marked(markdown)
  }

  /**
   * Retrieves the contents of the specified locations within the files.
   *
   * @param locations - An array of `vscode.Location` or `vscode.LocationLink` objects representing the locations to extract text from.
   * @returns A promise that resolves to a string containing the concatenated text from the specified locations.
   *          If no locations are provided or the locations array is empty, an empty string is returned.
   *
   * The function opens the documents corresponding to the URIs in the provided locations,
   * extracts the text within the specified ranges, and concatenates the non-empty contents.
   */
  async renderDefinitions(
    document: vscode.TextDocument,
    locations: (vscode.Location | vscode.LocationLink)[]
  ): Promise<string> {
    if (!locations || locations.length === 0) {
      return ''
    }

    // vscode.Location | vscode.LocationLink에서 uri에 해당하는 문서를 열고 range 내의 텍스트를 추출한다.
    const docs: string[] = []
    for (const location of locations) {
      let uri: vscode.Uri
      let rng: vscode.Range
      if (location instanceof vscode.Location) {
        uri = location.uri
        rng = location.range
      } else {
        uri = location.targetUri
        rng = location.targetRange
      }

      docs.push(await this.getFileContents(uri, rng))
    }

    return docs.filter(content => content.length > 0).join('\n')
  }

  /**
   * Retrieves the contents of a file within a specified range, including any relevant preceding lines
   * (such as comments or attributes) and extending to the end of the function or block.
   *
   * @param uri - The URI of the file to read.
   * @param range - The range within the file to read.
   * @returns A promise that resolves to the contents of the file within the specified range,
   *          including any relevant preceding lines and extending to the end of the function or block.
   */
  private async getFileContents(uri: vscode.Uri, range: vscode.Range): Promise<string> {
    const document = await vscode.workspace.openTextDocument(uri)

    // 이 코드를 사용해도 되지만 아래 코드를 사용하는 것이 더 좋다.
    // return document.getText(range)

    // Pseudocode
    // 1. 주어진 URI로 텍스트 문서를 엽니다.
    // 2. 파일의 전체 내용을 줄 단위로 읽어 배열에 저장합니다.
    // 3. 범위의 시작 라인의 들여쓰기 수준을 확인합니다.
    // 4. 범위 시작 라인 이전의 중요한 줄(주석, 속성 등)을 캡처합니다.
    // 5. 범위 시작 라인 이후의 나머지 줄을 캡처합니다.
    // 6. 관련 줄만 포함하도록 배열을 슬라이스하고, 선행 들여쓰기를 제거한 후 줄을 하나의 문자열로 결합합니다.
    // 7. 결합된 문자열을 반환합니다.

    // Read entire file.
    const rangeText = new vscode.Range(0, 0, document.lineCount, 0)
    let lines = document.getText(rangeText).split(/\r?\n/)
    let indent = lines[range.start.line].search(/\S/)

    // First, capture any preceding lines that may be important.
    // Typically only comments and attributes.
    const prefixes = ['@', '/', '#', '[', ';', '-']
    let firstLine = range.start.line
    for (let n = range.start.line - 1; n >= 0; n--) {
      let lineIndent = lines[n].search(/\S/)
      if (lineIndent < indent) {
        break
      }

      if (lines[n].length === 0) {
        break
      }

      // Only allow lines starting with specific chars.
      // Typically comments.
      if (!prefixes.includes(lines[n].trim().charAt(0))) {
        break
      }

      firstLine = n
    }

    // Now capture any remaining lines until the end of the function.
    let lastLine = range.end.line

    let insideBlock = false
    // Hack for C#/Godot definitions with no function body.
    // Also for variable defs.
    let trimmedStart = lines[range.start.line].trim()
    if (trimmedStart.search(/;$/) >= 0) {
      insideBlock = true
    }

    for (let n = range.start.line; n < lines.length; n++) {
      let lineIndent = lines[n].search(/\S/)
      let trimmedLine = lines[n].trim()

      let firstChar = trimmedLine.charAt(0)
      let lastChar = trimmedLine.charAt(trimmedLine.length - 1)

      if (trimmedLine.length > 0) {
        // Keep searching until the next non-blank line that is
        // at a shorter indent level.
        if (lineIndent < indent) {
          break
        } else if (insideBlock && lineIndent === indent) {
          // Ignore {
          // For C#/C/C++ where the { is on the next line.
          if (firstChar === '{') {
            if (n > lastLine) {
              lastLine = n
            }
            continue
          }

          // If the character is ), include it and keep going.
          // This catches things like this:
          // ```
          // fn some_func(
          //     a: String
          // ) {
          // ```
          if (firstChar === ')') {
            if (n > lastLine) {
              lastLine = n
            }
            continue
          }

          // If the character is }, include it.
          // Otherwise, exclude it (for languages like Python,
          // this would be the start of the next function)
          if (firstChar === '}') {
            if (n > lastLine) {
              lastLine = n
            }
          }

          break
        }

        // Nasty hacks :P
        let inBlockFirstChars = ['{']
        let inBlockLastChars = [':', '{', ';', '}']
        if (lineIndent > indent || inBlockFirstChars.includes(firstChar) || inBlockLastChars.includes(lastChar)) {
          insideBlock = true
        }

        if (n > lastLine) {
          lastLine = n
        }
      }
    }
    lines = lines.slice(firstLine, lastLine + 1).map(x => {
      return x.substring(indent)
    })
    return lines.join('\n') + '\n'
  }
}
