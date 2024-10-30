import * as vscode from 'vscode'

import { IssueItem, PrismItem } from './PrismTreeProvider'
import { PrismCommands } from './PrismCommands'
import { PrismLinkHoverProvider, PrismLinkProvider } from './PrismLinkProvider'
import { NoteDescription } from './PrismCommentController'
import { docdetector_activate } from './PrismDocDetector.js'
import { output } from './PrismOutputChannel.js'

/**
 * Activates the CodePrism extension by registering various commands and providers.
 *
 * @param context - The extension context provided by VSCode.
 *
 * This function performs the following actions:
 * - Registers multiple commands related to Prism environment, files, notes, and drafts.
 * - Registers hover providers for TypeScript and Python files.
 * - Registers a document link provider and a hover provider for all file types.
 * - Registers a command to open a document link.
 * - Registers a CodeLens provider for all file types.
 * - Loads Prism files and refreshes the view.
 */
export function prism_activate(context: vscode.ExtensionContext) {
  const prismCommands = new PrismCommands(context)
  context.subscriptions.push(prismCommands)

  output.activate(context)
  output.log('Code Prism is activating...')
  context.subscriptions.push(output)

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.showPrismFile', (item: PrismItem) => {
      prismCommands.showPrismFile(item)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.deletePrismFile', (item: PrismItem) => {
      prismCommands.deletePrismFile(item.prism)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.addIssue.context', (uri: vscode.Uri) => {
      prismCommands.addIssueByContext(uri)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.gotoIssue', (item: IssueItem) => {
      prismCommands.gotoIssue(item)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'CodePrism.command.deleteIssue',
      (threadOrItem: vscode.CommentThread | IssueItem) => {
        prismCommands.deleteIssue(threadOrItem)
      }
    )
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.addNote', (reply: vscode.CommentReply) => {
      prismCommands.addNote(reply)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.addNote.cancel', (reply: vscode.CommentReply) => {
      prismCommands.cancelAddNote(reply)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.editNote', (comment: NoteDescription) => {
      prismCommands.editNote(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.deleteNote', (comment: NoteDescription) => {
      prismCommands.deleteNote(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.saveNote', (comment: NoteDescription) => {
      prismCommands.saveNote(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.saveNote.cancel', (comment: NoteDescription) => {
      prismCommands.cancelSaveNote(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.collapseAll', () => {
      prismCommands.collapseView()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.expandAll', () => {
      prismCommands.expandView()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.reload', () => {
      prismCommands.reloadView()
    })
  )

  // Register the DocumentLinkProvider for all file types
  context.subscriptions.push(vscode.languages.registerDocumentLinkProvider({ language: '*' }, new PrismLinkProvider()))

  // Register the HoverProvider for all file types
  context.subscriptions.push(vscode.languages.registerHoverProvider('*', new PrismLinkHoverProvider()))

  // for test
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('CodePrism.command.showMarkdownPreviewToSide', (uri: string, option?: string) => {
  //     console.log('CodePrism.command.showMarkdownPreviewToSide called:', uri, option)
  //     vscode.commands.executeCommand('markdown.showPreviewToSide', vscode.Uri.file(uri))
  //     // vscode.workspace.openTextDocument(vscode.Uri.file(uri)).then(document => {
  //     //   vscode.window.showTextDocument(document, vscode.ViewColumn.Two)
  //     // })
  //   })
  // )

  docdetector_activate(context)
  output.log('activated doc-detector')

  prismCommands.loadPrismFiles()

  // // 이 코드는 TextEditor에서 symbol을 클릭했을때 Reference Result View를 오픈하는 코드이다.
  // // 이 뷰는 find all references, find all implementations, show call hierarchy 기능을 실행하면
  // // 오픈되는 뷰로써 이 뷰는 빌드인되어진 extension의 기능이다.
  // // Register the event listener for text editor selection change
  // let disposable = vscode.window.onDidChangeTextEditorSelection((event: vscode.TextEditorSelectionChangeEvent) => {
  //   const editor = event.textEditor
  //   const selection = event.selections[0]
  //   const text = editor.document.getText(selection)
  //   // const position = editor.selection.active

  //   // 명령 파레트에 표시되지 않은 명령들을 검색하고 표시하는 코드이다.
  //   // const allCommands = vscode.commands.getCommands()
  //   // vscode.window.showQuickPick(allCommands, { placeHolder: 'Select a command to execute' })

  //   // Reference를 검색하고 표시하는 것으로 보이는 많은 명령들이 있다.
  //   // 'openReference'
  //   // 'openReferenceToSide'
  //   // 'editor.action.showReferences'
  //   // 'editor.action.findReferences'
  //   // 'editor.action.referenceSearch.trigger'
  //   // 'references-view.findReferences'
  //   // 동작하는 명령은 'editor.action.referenceSearch.trigger', 'references-view.findReferences' 뿐이다.

  //   // text, position 모두 가능하다.
  //   vscode.commands.executeCommand('references-view.findReferences', text)
  //   // vscode.commands.executeCommand('references-view.findImplementations', text)
  //   // vscode.commands.executeCommand('references-view.showCallHierarchy', text)
  // })

  // context.subscriptions.push(disposable)

  output.log('activating is done')
}
