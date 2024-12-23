import * as vscode from 'vscode'
import path from 'path'

import { Prism, Issue } from './Prism'
import { PrismPath } from './PrismPath'
import { PrismFileSystem } from './PrismFileSystem'
import { PrismManager } from './PrismManager'
import { marked } from 'marked'

/**
 * Represents a webview panel in Visual Studio Code.
 *
 * @class PrismWebviewPanel
 *
 * @property {vscode.WebviewPanel} panel - The webview panel instance.
 *
 * @constructor
 * @param {string} id - The unique identifier for the webview panel.
 * @param {string} title - The title of the webview panel.
 * @param {vscode.ViewColumn} column - The column in which to show the webview panel.
 * @param {string} [content] - Optional HTML content to display in the webview.
 * @param {(message: any) => void} [messageListener] - Optional callback to handle messages received from the webview.
 * @param {() => void} [disposeListener] - Optional callback to handle the disposal of the webview panel.
 *
 * @method updateContent
 * @param {string} content - The new HTML content to display in the webview.
 *
 * @method postMessage
 * @param {any} message - The message to post to the webview.
 */
class PrismWebviewPanel {
  private panel: vscode.WebviewPanel

  /**
   * Creates an instance of PrismFileViewer.
   *
   * @param id - The unique identifier for the webview panel.
   * @param title - The title of the webview panel.
   * @param column - The column in which to show the webview panel.
   * @param content - Optional HTML content to display in the webview.
   * @param messageListener - Optional callback to handle messages received from the webview.
   * @param disposeListener - Optional callback to handle the disposal of the webview panel.
   */
  constructor(
    id: string,
    title: string,
    column: vscode.ViewColumn,
    content?: string,
    messageListener?: (message: any) => void,
    disposeListener?: () => void
  ) {
    this.panel = vscode.window.createWebviewPanel(id, title, column, {
      enableScripts: true,
      retainContextWhenHidden: true,
    })

    if (content) {
      this.panel.webview.html = content
    }

    // 웹뷰에 메시지 핸들러 추가
    if (messageListener) {
      this.panel.webview.onDidReceiveMessage(messageListener)
    }

    if (disposeListener) {
      this.panel.onDidDispose(disposeListener)
    }

    // 웹뷰에 포커스를 맞춘다.
    this.panel.reveal(column)
  }

  updateContent(content: string) {
    this.panel.webview.html = content
  }

  postMessage(message: any) {
    this.panel.webview.postMessage(message)
  }
}

/**
 * The `PrismViewer` class provides methods to display and interact with Prism files and their issues within a VS Code environment.
 *
 * @remarks
 * This class includes methods to:
 * - Display a Prism file in a VS Code webview or open a specific issue within the file.
 * - Open a Prism JSON file in a new editor tab.
 * - Open a source file in the editor and highlight a specific selection.
 * - Open a markdown file in a preview pane beside the current editor.
 * - Generate HTML content for a webview displaying the details of a given Prism object.
 * - Generate HTML content for a issue to be displayed in a webview.
 *
 * @example
 * ```typescript
 * // Open a Prism file
 * PrismViewer.openPrismFile(prism);
 *
 * // Open a source file and highlight a specific selection
 * PrismViewer.openSourceFile(issue);
 *
 * // Open a markdown file in a preview pane
 * PrismViewer.openMarkdownFile(issue);
 * ```
 */
export class PrismFileViewer {
  static prism: Prism
  static panel: PrismWebviewPanel

  /**
   * Displays a Prism file in a webview panel. If a issue is provided, it opens the source file
   * corresponding to the issue and navigates to the issue's location. If no issue is provided, it
   * performs the following actions:
   *
   * - Iterates through all issues in the Prism object and opens their source files.
   * - Creates a webview panel to display the Prism file.
   * - Adds a message handler to the webview to handle commands such as:
   *   - `appendNote`: Appends a note to a issue.
   *   - `removeNote`: Removes a note from a issue and updates the Prism file.
   *   - `createOrOpenLink`: Creates or opens a Markdown file associated with the Prism.
   *
   * @param prism The Prism object containing issues and notes.
   * @param issue Optional. The specific issue to open and navigate to.
   */
  static async showPrismViewer(prismOrIssue: Prism | Issue) {
    if (prismOrIssue instanceof Prism) {
      // PrismItem을 클릭했을 때
      this.prism = prismOrIssue

      // .prism.json 파일 자체를 표시한다.
      // openPrismJsonFile(prism)

      // // 모든 노트를 순회하며 소스파일을 열고, 해당 노트의 위치로 이동한다.
      // // 이 작업을 가장 먼저 수행해도 비동기 설정으로 인해 웹뷰가 표시되어진 이후에 수행된다.
      // // 그래서 항상 웹뷰가 비활성화 상태로 표시되는 문제가 있다.
      // const openAllSources = async () => {
      //   for (const issue of prism.issues!) {
      //     this.openSourceFile(issue)
      //   }
      // }

      // await openAllSources()

      // 웹뷰를 생성하고 HTML을 로드한다.
      // 이 뷰가 최종적으로 active되는게 좋으므로 가장 마지막에 호출한다.
      this.panel = new PrismWebviewPanel(
        'code-prism-view',
        `CodePrism:${this.prism.name}`,
        vscode.ViewColumn.One,
        this.getWebviewContent(this.prism),
        (message: any) => {
          this.onReceiveMessage(message)
        }
      )
    } else {
      // IssueItem을 클릭했을 때
      // 해당 소스파일을 열고, 해당 노트의 위치로 이동한다.
      this.openSourceFile(prismOrIssue)
    }
  }

  /**
   * Opens a Prism JSON file in a new editor tab.
   *
   * This function checks if the specified Prism file exists. If it does, the file is opened
   * in a new editor tab (ViewColumn.Two). If the file does not exist, a warning message is shown.
   *
   * @param prism - The Prism object containing the name of the Prism file to open.
   */
  static openPrismFile(prism: Prism) {
    // sample.prism.json 파일을 그대로 표시한다.
    if (!PrismFileSystem.isPrismFileExists(prism.name)) {
      vscode.window.showWarningMessage('The prism does not exist.')
      return
    }

    // 여러가지 방법이 가능하다.

    // 1. workspace.openTextDocument()와 window.showTextDocument()를 사용
    // 이경우에도 uri를 사용할 수도 있고 절대경로를 사용할 수도 있다.
    // const uri = vscode.Uri.file(PrismManager.getPrismFilePath(prism.name))
    // vscode.workspace.openTextDocument(uri).then(document => {
    //   vscode.window.showTextDocument(document, vscode.ViewColumn.Two)
    // })
    const prismJsonPath = PrismPath.getPrismFilePath(prism.name)
    vscode.workspace.openTextDocument(prismJsonPath).then(document => {
      vscode.window.showTextDocument(document, vscode.ViewColumn.Two)
    })

    // // 2. vscode.commands.executeCommand()를 사용
    // const uri = vscode.Uri.file(PrismManager.getPrismFilePath(prism.name))
    // vscode.commands.executeCommand('vscode.open', uri, vscode.ViewColumn.Two)
  }

  /**
   * Opens a source file in the editor and highlights a specific selection.
   *
   * This function takes a `Issue` object, extracts the file path and selection
   * range from it, and then opens the file in the editor with the specified
   * selection highlighted.
   *
   * There are multiple ways to achieve this:
   *
   * 1. Using `vscode.workspace.openTextDocument()` and `vscode.window.showTextDocument()`.
   * 2. Using `vscode.commands.executeCommand()` (commented out in the code).
   *
   * @param issue - The `Issue` object containing the source file path and selection range.
   */
  static openSourceFile(issue: Issue) {
    const uri = vscode.Uri.file(PrismPath.getAbsolutePath(issue.source.file))
    const selection = new vscode.Selection(
      new vscode.Position(issue.source.startLine - 1, issue.source.startColumn),
      new vscode.Position(issue.source.endLine - 1, issue.source.endColumn)
    )

    // 여러가지 방법이 가능하다.

    // 1. workspace.openTextDocument()와 window.showTextDocument()를 사용
    vscode.workspace.openTextDocument(uri).then(document => {
      vscode.window.showTextDocument(document, {
        selection,
      })
    })

    // 2. vscode.commands.executeCommand()를 사용
    // // see https://code.visualstudio.com/api/references/commands
    // await vscode.commands.executeCommand('vscode.openWith', uri, 'default', {
    //   selection,
    // } as vscode.TextDocumentShowOptions)
  }

  /**
   * Opens a markdown file in a preview pane beside the current editor.
   *
   * @param issue - The issue object containing the note with a link to the markdown file.
   *
   * The function converts a relative file path from the issue's note to an absolute path,
   * creates a VS Code URI from the absolute path, and then executes the `markdown.showPreview`
   * command to open the markdown file in a preview pane beside the current editor.
   */
  static openMarkdownFile(issue: Issue | string) {
    let relativePath: string
    if (typeof issue === 'string') {
      relativePath = issue + '.md'
    } else {
      relativePath = issue.notes[0].link?.replace('file:///./', '')!
    }

    // 상대 경로를 절대 경로로 변환
    const absolutePath = path.join(PrismPath.getPrismFolderPath(), 'docs', relativePath!)

    // // markdown.showPreview를 사용하여 마크다운 파일을 미리보기 창에 열기
    // const docu_file_uri = vscode.Uri.file(absolutePath)
    // vscode.commands.executeCommand('markdown.showPreview', docu_file_uri, {
    //   resource: docu_file_uri,
    //   viewColumn: vscode.ViewColumn.Beside,
    //   preserveFocus: false, // 미리보기 창을 활성화 상태로 열기 위해 false로 설정
    // })

    vscode.workspace.openTextDocument(absolutePath).then(document => {
      vscode.window.showTextDocument(document, vscode.ViewColumn.Two)
    })
  }

  /**
   * Generates the HTML content for a webview displaying the details of a given Prism object.
   *
   * @param prism - The Prism object containing the data to be displayed in the webview.
   * @returns A string containing the HTML content for the webview.
   */
  static getWebviewContent(prism: Prism): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CodePrism Viewer</title>
      <style>
        .common-button {
          color: white;
          border: none;
          padding: 5px;
          cursor: pointer;
        }
        .append-button {
          background-color: blue;
        }
        .delete-button {
          background-color: red;
        }
      </style>
    </head>
    <body>
      <h1>Code Prism File: ${prism.name}</h1>
      ${this.getArticle()}
      ${this.getScript()}
    </body>
    </html>`
  }

  /**
   * Generates an HTML article containing issues and their notes.
   *
   * This method constructs an HTML string that represents a collection of issues.
   * Each issue includes its title, source information, and a list of notes.
   * Each note includes details such as category, importance, creation date,
   * and a link to create or open a markdown file.
   *
   * @returns {string} An HTML string representing the issues and their notes.
   */
  static getArticle(): string {
    const getIssue = (issue: Issue) => {
      const sourcePath = PrismPath.getAbsolutePath(issue.source.file).replace(/\\/g, '/')
      // const sourceLink: string = `<a href="file:///${sourcePath}">` + sourcePath + '</a>'
      // prettier-ignore
      return `
        <h2>Issue: '${issue.title}'</h2>
        ${issue.source ? `<p>Source: ${sourcePath}(line: ${issue.source.startLine})</p>` : '<p>Source: N/A</p>'}
        ${issue.notes.map(note => {
          const safeId = `'${note.id}'` //encodeURIComponent(note.id).substring(0, 8)
          return `
            <div class="note" id="note-${note.id}">
              <h3>Note : ${safeId}</h3>
              <button class="common-button delete-button" onclick="deleteNote(${safeId})">Delete note</button>
              <div><ul>
                <li>category: ${note.category}</li>
                <li>importance: ${note.importance}</li>
                <li>createdAt: ${note.createdAt}</li>
                <li>link: <a href="Create or Open Link" onclick="createOrOpenLink(${safeId})">
                  ${note.link ? 'Open Markdown' : 'Create Markdown'}</a>
                </li>
              </ul></div>
              contents: ${getDesc(note.content)}
            </div>
          `}).join('')}
        <button class="common-button append-button" onclick="appendNote(${issue.id})">New note</button>
      `
      // const markdown = new vscode.MarkdownString()
      // markdown.appendMarkdown(`## Issue: ${issue.title}\n`)
      // markdown.appendMarkdown(
      //   issue.source ? `Source: ${issue.source.file}(line: ${issue.source.startLine})\n` : 'Source: N/A\n'
      // )
      // issue.notes.forEach(note => {
      //   markdown.appendMarkdown(`### Note: ${note.id}\n`)
      //   markdown.appendMarkdown(`- category: ${note.category}\n`)
      //   markdown.appendMarkdown(`- importance: ${note.importance}\n`)
      //   markdown.appendMarkdown(`- createdAt: ${note.createdAt}\n`)

      //   markdown.appendText('\n\n')
      //   const lines = note.content.split('\n')
      //   lines.forEach(line => {
      //     markdown.appendMarkdown(`> ${line}\n`)
      //   })
      // })
      // return marked(markdown.value, { async: false })
    }

    const getDesc = (contents: string) => {
      const markdown = new vscode.MarkdownString()
      markdown.appendText('\n\n')
      const lines = contents.split('\n')
      lines.forEach(line => {
        markdown.appendMarkdown(`> ${line}\n`)
      })
      return marked(markdown.value, { async: false })
    }

    const getMarkdownLink = (link: string | undefined) => {
      const markdown = new vscode.MarkdownString()
      markdown.appendMarkdown(`[Open Markdown](${link})`)
      return marked(markdown.value, { async: false })
    }

    return `
      <article>
        ${this.prism.issues.map(issue => getIssue(issue)).join('')}
      </article>`
  }

  /**
   * Generates an HTML script string that includes functions for interacting with VS Code API.
   *
   * The script includes the following functions:
   * - `appendNote()`: Sends a message to VS Code to append a note.
   * - `deleteNote(id)`: Removes a note element by its ID and sends a message to VS Code to remove the note.
   * - `createOrOpenLink(id)`: Logs the action and sends a message to VS Code to create or open a link.
   *
   * @returns {string} The HTML script string.
   */
  static getScript(): string {
    return `
      <script>
        const vscode = acquireVsCodeApi();
        function appendNote() {
          vscode.postMessage({ command: 'appendNote', id });
        }
        function deleteNote(id) {
          const noteElement = document.getElementById('note-' + id);
          if (noteElement) {
            noteElement.remove();
          }
          vscode.postMessage({ command: 'removeNote', id });
        }
        function createOrOpenLink(id) {
          vscode.postMessage({ command: 'createOrOpenLink', id });
        }
      </script>`
  }

  static onReceiveMessage(message: any) {
    const result = PrismManager.findPrismIssueNoteByNoteId(message.id)
    if (!result) {
      return
    }

    switch (message.command) {
      case 'appendNote':
        vscode.window.showInformationMessage(message.command + `: ${message.id}`)
        this.prism.issues.filter(issue => issue.id !== message.id)
        //todo: note를 추가해야한다.
        break
      case 'removeNote':
        // prism 파일 자체를 업데이트한다.
        // message.id에 해당하는 note을 가지고 있는 issue를 찾아서 해당 note을 제거한다.
        vscode.window.showInformationMessage(message.command + `: found-${result.note.id}`)
        this.prism.removeNote(result.issue.id, message.id)
        PrismManager.updatePrism(this.prism)
        break
      case 'createOrOpenLink':
        // markdown 파일을 생성하거나 열어서 보여준다.
        vscode.window.showInformationMessage(message.command + `: ${message.id}`)
        // PrismManager.createMarkdownFile()는 파일이 이미 있으면 생성하지 않고 false를 리턴한다.
        const exist = !PrismFileSystem.createMarkdownFile(message.id, this.prism, result.issue)
        if (!exist) {
          // 파일이 새로 생성되었을 경우에는 note의 link를 업데이트한다.
          if (result.note) {
            const link = 'file:///./docs/' + message.id + '.md'
            this.prism.updateNote(result.issue.id, { link, ...result.note })
            PrismManager.updatePrism(this.prism)

            this.panel.updateContent(this.getWebviewContent(this.prism))
          }
        }
        this.openMarkdownFile(message.id)
        break
    }
  }
}
