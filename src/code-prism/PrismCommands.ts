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
 * Activates the Code Prism extension.
 *
 * This function initializes and registers various components and commands
 * related to the Code Prism extension, including the Prism tree view, comment
 * controller, and various commands for managing Prism files, issues, and notes.
 *
 * @param context - The extension context provided by VSCode.
 */
export async function prism_activate(context: vscode.ExtensionContext) {
  /**
   * An instance of PrismTreeProvider which is responsible for providing
   * the data and functionality required to manage and display the prism tree structure.
   */
  const prismTreeProvider = new PrismTreeProvider()
  //context.subscriptions.push(prismTreeProvider)
  prismTreeProvider.register()

  /**
   * Creates a TreeView for the CodePrism extension.
   *
   * @param {string} id - The identifier for the TreeView.
   * @param {vscode.TreeDataProvider<PrismItem>} treeDataProvider - The data provider for the TreeView.
   * @param {boolean} showCollapseAll - Whether to show the "Collapse All" button in the TreeView.
   */
  const prismTreeView: vscode.TreeView<PrismItem> = vscode.window.createTreeView('CodePrism.view.prismView', {
    treeDataProvider: prismTreeProvider,
    showCollapseAll: true,
  })
  context.subscriptions.push(prismTreeView)

  /**
   * Initializes a new instance of the `PrismCommentController` class.
   * The `PrismCommentController` class is responsible for handling vscode.CommentController
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

  // CodePrism.command.prismFile.show command는 다음의 두 가지 경우에만 발생한다.
  // 1) PrismTreeView에서 PrismItem 자체를 클릭
  // 2) PrismTreeView의 PrismItem의 context menu에서 show icon를 클릭
  // 1)의 경우에는 command를 직접 호출하는 경우이므로 argument를 prism으로 할 수 있지만
  // 2)의 경우에는 VS Code에 의해서 PrismItem이 전달되기 때문에 1)의 경우도 인수를 PrismItem으로 하여 동일하게 처리되게 하였다.
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

  // CodePrism.command.issue.delete command는 다음의 두 가지 경우에서 발생할 수 있고 그래서 인수가 복잡하다.
  // 1) PrismTreeView의 PrismItem의 context menu에서 delete icon를 클릭 : "view/item/context" 참고
  // 2) Comment Controller의 thread context menu에서도 삭제할 수 있다 : "comments/commentThread/title" 참고
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

  // comment controller는 comment(note)를 추가할때 vscode.CommentReply를 전달한다.
  // PrismTreeView는 note를 직접적으로 다루지 않기 때문에 note 관련 command는 모두 comment controller에서 발생한다.
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
    vscode.commands.registerCommand('CodePrism.command.prismView.reload', async () => {
      const prisms = await PrismManager.loadPrismFiles()
      prismTreeProvider.reload(prisms)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.asTree', () => {
      prismTreeProvider.refresh('tree', '')
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.asList', () => {
      prismTreeProvider.refresh('list', '')
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.sortByName', () => {
      prismTreeProvider.refresh('', 'name')
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.sortByCategory', () => {
      prismTreeProvider.refresh('', 'cate')
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.sortByCreation', () => {
      prismTreeProvider.refresh('', 'time')
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

  linkdetector_activate(context)
  output.log('activated link-detector')

  docdetector_activate(context)
  output.log('activated doc-detector')

  // load all Prism files
  const prisms = await PrismManager.loadPrismFiles()
  commentController.reload(prisms)
  prismTreeProvider.reload(prisms)

  output.log('activating is done')

  // vscode.commands.executeCommand('CodePrism.command.test')
  // // 나중에 테스트용으로 사용할 목적으로 남겨둔다.
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('CodePrism.command.test', () => {
  //     console.log('CodePrism.command.test called:')
  //     vscode.commands.executeCommand('workbench.action.addComment')
  //     // vscode.commands.executeCommand('markdown.showPreviewToSide', vscode.Uri.file(uri))
  //     // vscode.workspace.openTextDocument(vscode.Uri.file(uri)).then(document => {
  //     //   vscode.window.showTextDocument(document, vscode.ViewColumn.Two)
  //     // })
  //   })
  // )
  // context.subscriptions.push(
  //   vscode.commands.registerCommand('CodePrism.command.showQuickPickExample', async () => {
  //     const pickItems: vscode.QuickPickItem[] = [
  //       { label: 'Option 1', description: 'This is option 1' },
  //       { label: 'Option 2', description: 'This is option 2' },
  //       { label: 'Option 3', description: 'This is option 3' },
  //     ]

  //     const selected = await vscode.window.showQuickPick(pickItems, {
  //       placeHolder: 'Select an option',
  //     })

  //     if (selected) {
  //       vscode.window.showInformationMessage(`You selected: ${selected.label}`)
  //     } else {
  //       vscode.window.showInformationMessage('No option selected')
  //     }
  //   })
  // )
}
