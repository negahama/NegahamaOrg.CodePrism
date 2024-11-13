import * as vscode from 'vscode'
import path from 'path'

import { PrismPath } from './PrismPath'

export namespace PrismSearchEditor {
  /**
   * Activates the extension by registering commands for finding references and implementations.
   *
   * @param context - The extension context provided by VSCode.
   *
   * The function registers two commands:
   * - `CodePrism.command.findReferences`: Finds all references of the symbol at the current cursor position
   *   in the active text editor and opens a search editor with the results.
   * - `CodePrism.command.findImplementations`: Finds all implementations of the symbol at the current cursor position
   *   in the active text editor and opens a search editor with the results.
   *
   * Both commands handle cases where the references or implementations are located in `node_modules` by opening the
   * corresponding file in a new editor tab before performing the search.
   */
  export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.commands.registerCommand('CodePrism.command.findReferences', async () => {
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

          let includeList: string[] = []
          for (const ref of references) {
            let fsPath = ref.uri.fsPath
            if (fsPath.includes('node_modules')) {
              // node_modules에 있는 파일인 경우에는 Search editor에서 읽어들이지 못하는 것 같다.
              // 그래서 해당 파일을 오픈한 상태에서 search를 시도해 본다.
              const doc = await vscode.workspace.openTextDocument(fsPath)
              await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two)
              fsPath = path.parse(fsPath).base
            } else {
              fsPath = PrismPath.getRelativePath(fsPath)
            }
            if (!includeList.includes(fsPath)) {
              includeList.push(fsPath)
            }
          }
          const includes = includeList.join(',')

          /* 사용 가능한 arguments
          {
            query: string,
            includes: string,
            excludes: string,
            contextLines: number,
            wholeWord: boolean,
            caseSensitive: boolean,
            regexp: boolean,
            useIgnores: boolean,
            showIncludesExcludes: boolean,
            triggerSearch: boolean,
            focusResults: boolean,
          }
          */
          await vscode.commands.executeCommand('search.action.openNewEditor', {
            query: symbol,
            includes,
          })
        } catch (error) {
          console.error(error)
        }
      })
    )
    context.subscriptions.push(
      vscode.commands.registerCommand('CodePrism.command.findImplementations', async () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) {
          return
        }

        const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active)
        const symbol = editor.document.getText(wordRange)

        try {
          const locations = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
            'vscode.executeDefinitionProvider',
            editor.document.uri,
            editor.selection.active
          )
          if (!locations) {
            console.log('No implementation found.')
            return
          }

          let includeList: string[] = []
          for (const ref of locations) {
            let fsPath: string = ''
            if (ref instanceof vscode.Location) {
              fsPath = ref.uri.fsPath
            } else {
              fsPath = ref.targetUri.fsPath
            }

            if (fsPath.includes('node_modules')) {
              // node_modules에 있는 파일인 경우에는 Search editor에서 읽어들이지 못하는 것 같다.
              // 그래서 해당 파일을 오픈한 상태에서 search를 시도해 본다.
              const doc = await vscode.workspace.openTextDocument(fsPath)
              await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two)
              fsPath = path.parse(fsPath).base
            } else {
              fsPath = PrismPath.getRelativePath(fsPath)
            }
            if (!includeList.includes(fsPath)) {
              includeList.push(fsPath)
            }
          }
          const includes = includeList.join(',')

          // 사용 가능한 arguments [[al=c0a2438db86886cf89aee7aa0ec0ea1b]]
          await vscode.commands.executeCommand('search.action.openNewEditor', {
            query: symbol,
            includes,
          })
        } catch (error) {
          console.error(error)
        }
      })
    )
  }
}
