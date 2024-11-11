import * as vscode from 'vscode'

import { PrismPath } from './PrismPath'

export namespace PrismRefDiagramGenerator {
  /**
   * Activates the CodePrism extension and registers the command to generate a reference diagram.
   *
   * @param context - The extension context provided by VS Code.
   *
   * This function registers the 'CodePrism.command.GenRefDiagram' command, which when executed,
   * retrieves the active text editor and the currently selected word. It then finds all references
   * to the selected word in the workspace and generates a Mermaid diagram representing these references.
   * The diagram is copied to the clipboard.
   */
  export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.commands.registerCommand('CodePrism.command.GenRefDiagram', async () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) {
          return
        }

        const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active)
        const symbol = editor.document.getText(wordRange)

        try {
          const references = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeReferenceProvider',
            editor.document.uri,
            editor.selection.active
          )
          if (!references) {
            console.log('No references found.')
            return
          }

          let diagram: string[] = []
          diagram.push('```mermaid')
          diagram.push('graph LR')
          references.forEach((reference, index) => {
            let targetName = PrismPath.getRelativePath(reference.uri.fsPath)
            const targetLine = reference.range.start.line + 1
            // console.log(`Reference found at ${targetName}:${targetLine}`)

            // targetName의 길이가 너무 길면 뒤에서 20자만 취한다.
            if (targetName.length > 20) {
              targetName = '...' + targetName.substring(targetName.length - 20, 20)
            }

            diagram.push(`  0(${symbol}) --> ${index + 1}(${targetName}:${targetLine})`)
          })
          diagram.push('```')

          // Copy to clipboard
          vscode.env.clipboard.writeText(diagram.join('\n'))
        } catch (error) {
          console.error(error)
        }
      })
    )
  }
}
