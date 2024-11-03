import * as vscode from 'vscode'
import * as path from 'path'

import { Issue, Prism } from './Prism'
import { PrismManager } from './PrismManager'
import { NoteDescription, PrismCommentController } from './PrismCommentController'
import { IssueItem, PrismItem, TreeElement, PrismTreeProvider } from './PrismTreeProvider'
import { PrismFileManager } from './PrismFileManager'
import { PrismViewer } from './PrismViewer'
import { linkdetector_activate } from './PrismLinkDetector'
import { docdetector_activate } from './PrismDocDetector'
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
export async function prism_activate(context: vscode.ExtensionContext) {
  /**
   * An instance of `PrismProvider` used to manage and provide
   * functionalities related to the Prism framework within the application.
   */
  const prismTreeProvider = new PrismTreeProvider()
  //context.subscriptions.push(prismTreeProvider)
  prismTreeProvider.register()

  const prismTreeView: vscode.TreeView<PrismItem> = vscode.window.createTreeView('CodePrism.view.prismView', {
    treeDataProvider: prismTreeProvider,
    showCollapseAll: true,
  })
  context.subscriptions.push(prismTreeView)

  /**
   * An instance of `PrismCommentController` responsible for handling comment-related operations
   * within the Prism code documentation tool.
   */
  const commentController = new PrismCommentController(context)

  vscode.workspace.onDidChangeTextDocument(changeEvent => {
    const issues = PrismManager.findIssuesBySource(changeEvent.document.fileName)

    let needUpdate = false
    changeEvent.contentChanges.forEach(change => {
      const line1 = change.range.start.line
      const line2 = change.range.end.line

      if (change.text.length > 0 && change.rangeLength === 0) {
        // 텍스트가 추가되었을 때 (change.text는 추가된 텍스트)
        // 텍스트 추가인 경우에도 라인이 추가되는 경우가 아니면 처리하지 않는다.
        if (!change.text.includes('\n')) {
          return
        }
        // 추가된 텍스트의 위치가 issue.source.startLine보다 위에 있으면 lineCount만큼 내린다
        // issue.source.startLine보다 아래에 있으면 현재 위치를 유지하고 이 두 경우는 정상적인 동작이다.
        // 문제는 추가된 텍스트의 위치가 issue.source.startLine가 같은 위치인 경우인데 이 경우는 상황에 따라서
        // 현재 위치를 유지하는 것이 맞을 수도 있고 내리는 것이 맞을 수도 있다. 현재 위치의 내용이 변경되지 않고
        // 텍스트가 추가만 되어진 경우에는 아래로 내리는 것이 맞지만 commentController 자체가 그렇게 동작하지 않기 때문에
        // 일단 현재 위치를 유지하는 것으로 해서 commentController와 동일하게 동작하게 한다.
        issues.forEach(issue => {
          if (issue.source.startLine > line1) {
            const matchResult = change.text.match(/\n/g)
            const lineCount = matchResult ? matchResult.filter(item => item !== '').length : 0
            issue.source.startLine += lineCount
            issue.source.endLine += lineCount
            needUpdate = true
          }
        })
      } else if (change.text.length === 0 && change.rangeLength > 0) {
        // 텍스트가 삭제되었을 때 (rangeLength는 삭제된 텍스트의 길이)
        // 삭제된 텍스트의 위치가 issue.source.startLine보다 위에 있으면 lineCount만큼 올린다
        issues.forEach(issue => {
          if (issue.source.startLine > line1) {
            const lineCount = line2 - line1
            issue.source.startLine -= lineCount
            issue.source.endLine -= lineCount
            needUpdate = true
          }
        })
      }
    })

    if (needUpdate) {
      PrismManager.getAllPrisms().forEach(prism => {
        PrismManager.updatePrism(prism)
      })
    }
  })

  output.activate(context)
  output.log('Code Prism is activating...')
  context.subscriptions.push(output)

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismFile.show', (item: PrismItem) => {
      PrismViewer.showPrismViewer(item.prism)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismFile.delete', async (item: PrismItem) => {
      const prism = item.prism
      if (!PrismFileManager.isPrismFileExists(prism.name)) {
        vscode.window.showWarningMessage('The prism does not exist.')
        return
      }

      const selectedItem = await vscode.window.showWarningMessage(
        `Are you sure to delete ${prism.name}?`,
        'Continue',
        'Cancel'
      )
      if ('Continue' !== selectedItem) {
        return
      }

      PrismManager.deletePrism(prism)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.issue.addByContext', (uri: vscode.Uri) => {
      commentController.addIssueByContext(uri)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.issue.changePosition', (thread: vscode.CommentThread) => {
      commentController.changeIssuePosition(thread)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.issue.goto', (item: IssueItem) => {
      PrismViewer.showPrismViewer(item.prism, item.issue)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'CodePrism.command.issue.delete',
      (threadOrItem: vscode.CommentThread | IssueItem) => {
        let prism: Prism | undefined
        let issue: Issue | undefined

        if (threadOrItem instanceof IssueItem) {
          const item = threadOrItem as IssueItem
          prism = item.prism
          issue = item.issue
        } else {
          const thread = threadOrItem as vscode.CommentThread
          const prismName = path.parse(thread!.uri.fsPath).name
          prism = PrismManager.getPrism(prismName)
          if (prism) {
            issue = prism.getIssue(thread.contextValue!)
          }
        }

        if (prism && issue) {
          prism.removeIssue(issue.id)
          PrismManager.updatePrism(prism)
        }

        // 아래 코드는 thread를 dispose하기 때문에 가장 마지막에 실행한다.
        commentController.deleteIssue(threadOrItem)
      }
    )
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.add', (reply: vscode.CommentReply) => {
      commentController.addNote(reply)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.addCancel', (reply: vscode.CommentReply) => {
      commentController.cancelAddNote(reply)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.delete', (comment: NoteDescription) => {
      commentController.deleteNote(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.changeCategory', (comment: NoteDescription) => {
      commentController.changeNoteCategory(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.makeMarkdown', (comment: NoteDescription) => {
      commentController.makeMarkdown(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.edit', (comment: NoteDescription) => {
      commentController.editNote(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.save', (comment: NoteDescription) => {
      commentController.saveNote(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.saveCancel', (comment: NoteDescription) => {
      commentController.cancelSaveNote(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.reload', () => {
      prismTreeProvider.reload()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.expandAll', async () => {
      const expandAllItems = async (item: TreeElement) => {
        await prismTreeView.reveal(item, { expand: true, focus: false, select: false })
        const children = await prismTreeProvider.getChildren(item)
        if (children) {
          for (const child of children) {
            await expandAllItems(child)
          }
        }
      }

      // item을 확장하는 것은 reveal을 통해서 할 수 있다.
      // expand를 지정해 reveal을 호출하더라도 element.collapsibleState의 값은 전혀 변경되지 않는다.
      // 또한 element.collapsibleState를 변경하더라도 이것 자체로 확장, 축소가 화면에 반영되는 것도 아니다.
      const rootElements = await prismTreeProvider.getChildren()
      for (const rootElement of rootElements) {
        await expandAllItems(rootElement)
      }

      prismTreeProvider.refreshPrismView()
    })
  )

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

  linkdetector_activate(context)
  output.log('activated link-detector')

  docdetector_activate(context)
  output.log('activated doc-detector')

  // load all Prism files
  const prisms = await PrismManager.loadPrismFiles()
  commentController.reload(prisms)
  prismTreeProvider.reload(prisms)

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
