import * as vscode from 'vscode'

/* for testing...
```mermaid
graph TD
    B["fa:fa-twitter for peace"]
    B-->C[fa:fa-ban forbidden]
    B-->D(fa:fa-spinner);
    B-->E(A fa:fa-hand-paper perhaps?);
```
```mermaid
sequenceDiagram
    Alice ->> Bob: Hello Bob, how are you?
    Bob-->>John: How about you John?
    Bob--x Alice: I am good thanks!
    Bob-x John: I am good thanks!

    Bob-->Alice: Checking with John....
    Alice->John: Yes... John, how are you?
```
*/
export async function mermaid_activate(context: vscode.ExtensionContext) {
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let command = vscode.commands.registerCommand('CodePrism.command.OpenMermaidView', () => {
    const disposables: vscode.Disposable[] = []
    const panel = vscode.window.createWebviewPanel(
      'code-prism-mermaid-view',
      'CodePrism Mermaid View',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
      }
    )

    const getContent = (diagram: string | undefined) => {
      let pre = `
      \`\`\`mermaid
      diagram is rendered when the
      cursor is inside the fence
      \`\`\``
      if (diagram !== undefined) {
        pre = `<pre class="mermaid"> ${diagram} </pre>`
      }

      return `
      <!DOCTYPE html>
      <html lang="en">
        <body>
          ${pre}
          <script type="module">
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
          </script>
        </body>
      </html>
      `
    }

    //     const getContent = () => {
    //       const config = vscode.workspace.getConfiguration("mermaid");
    //       const configString = JSON.stringify(config);

    //       const faBase = panel.webview.asWebviewUri(
    //         vscode.Uri.file(
    //           context.asAbsolutePath(
    //             "previewer/dist/vendor/font-awesome/css/font-awesome.min.css"
    //           )
    //         )
    //       );

    //       const jsUrl = panel.webview.asWebviewUri(
    //         vscode.Uri.file(context.asAbsolutePath("previewer/dist/index.js"))
    //       );

    //       return `
    // <!DOCTYPE html>
    // <html>
    //   <head>
    //     <base href="">
    //     <link rel="stylesheet" href="${faBase}">
    //     <script>
    //       window._config = JSON.parse('${configString}');
    //     </script>
    //   </head>
    //   <body>
    //     <div id="root"></div>
    //     <script src="${jsUrl}" />
    //   </body>
    // </html>
    // `;
    //     };

    /**
     *
     * @param text
     * @param cursor
     * @returns
     */
    const findDiagram = (text: string, cursor: number) => {
      const regexp = /```mermaid[= ,;\(\)\?"\w]*$([\s\S]*?)```/gm
      let index = 0
      let diagram
      let array

      while (!diagram && (array = regexp.exec(text)) !== null) {
        const start = text.indexOf(array[1], index)
        const end = start + array[1].length

        if (start > 0 && start <= cursor && cursor <= end) {
          diagram = array[1]
        } else {
          index = regexp.lastIndex
        }
      }

      return diagram
    }

    /**
     *
     * @returns
     */
    const previewHandler = () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        return
      }

      const text = editor.document.getText()
      const cursor = editor.document.offsetAt(editor.selection.anchor)

      const diagram = findDiagram(text, cursor)

      panel.webview.postMessage({
        diagram,
      })
      panel.webview.html = getContent(diagram)
    }

    vscode.workspace.onDidChangeTextDocument(
      e => {
        if (e.document === vscode.window.activeTextEditor!.document) {
          previewHandler()
        }
      },
      null,
      disposables
    )

    vscode.workspace.onDidChangeConfiguration(
      e => {
        panel.webview.html = getContent(undefined)
        // panel.webview.html = getContent();
      },
      null,
      disposables
    )

    vscode.window.onDidChangeTextEditorSelection(
      e => {
        if (e.textEditor === vscode.window.activeTextEditor!) {
          previewHandler()
        }
      },
      null,
      disposables
    )

    panel.onDidDispose(
      () => {
        while (disposables.length) {
          const item = disposables.pop()
          if (item) {
            item.dispose()
          }
        }
      },
      null,
      context.subscriptions
    )

    panel.webview.html = getContent(undefined)
    // panel.webview.html = getContent();
  })

  context.subscriptions.push(command)

  // Register CodeLens provider
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ language: '*' }, new PrismMermaidLensProvider())
  )
}

// This method is called when your extension is deactivated
export function deactivate() {}

/**
 * Provides code lenses for documents containing Mermaid diagrams.
 *
 * This class implements the `vscode.CodeLensProvider` interface to provide
 * code lenses that allow users to open Mermaid diagrams in a preview window.
 *
 * @implements {vscode.CodeLensProvider}
 */
export class PrismMermaidLensProvider implements vscode.CodeLensProvider {
  /**
   * Each provider requires a provideCodeLenses function which will give the various documents the code lenses
   *
   * @param document
   * @returns
   */
  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const lenses: vscode.CodeLens[] = []
    if (document.uri.scheme === 'output') {
      return []
    }

    const doc = document.getText()
    const regExp = /```mermaid([\s\S]*?)```/gm
    const matches = doc.match(regExp)
    if (!matches) {
      return []
    }

    const found: any = []
    doc.split(/\r?\n/).forEach((line, lineNumber) => {
      const match = line.match(/```mermaid/gm)
      if (match) {
        found.push(lineNumber)
      }
    })
    found.forEach((lineNumber: any) => {
      const command: vscode.Command = {
        title: `Open diagram`,
        command: 'CodePrism.command.OpenMermaidView',
        arguments: [document.uri],
      }
      lenses.push(new vscode.CodeLens(new vscode.Range(lineNumber, 0, lineNumber, 0), command))
    })

    return lenses
  }
}
