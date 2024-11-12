import * as vscode from 'vscode'
import * as path from 'path'

import { Issue, Prism } from './Prism'
import { PrismManager } from './PrismManager'
import { PrismComment, PrismCommentController } from './PrismCommentController'
import { PrismItem, IssueItem, PrismTreeViewElement, PrismTreeProvider } from './PrismTreeProvider'
import { PrismFileViewer } from './PrismFileViewer'
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
   * Creates a TreeView instance for the 'CodePrism.view.prismView' view.
   * The TreeView is populated using the provided `prismTreeProvider` and
   * includes a 'Collapse All' button.
   *
   * @param {string} id - The unique identifier for the TreeView.
   * @param {vscode.TreeDataProvider} treeDataProvider - The data provider for the TreeView.
   * @param {boolean} showCollapseAll - Whether to show the 'Collapse All' button.
   */
  const prismTreeView = vscode.window.createTreeView('CodePrism.view.prismView', {
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
    const prism = PrismManager.findPrismBySource(changeEvent.document.fileName)
    if (!prism) {
      return
    }

    let needUpdate = false
    changeEvent.contentChanges.forEach(change => {
      const line1 = change.range.start.line
      const line2 = change.range.end.line

      let lineCount = 0
      if (change.text.length === 0 && change.rangeLength === 0) {
        // select만 해도 발생한다. 이 경우는 처리하지 않는다.
        return
      } else if (change.text.length > 0 && change.rangeLength === 0) {
        // 텍스트가 추가되었을 때 (change.text는 추된 텍스트)
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
        const matchResult = change.text.match(/\n/g)
        lineCount = matchResult ? matchResult.filter(item => item !== '').length : 0
      } else if (change.text.length === 0 && change.rangeLength > 0) {
        // 텍스트가 삭제되었을 때 (rangeLength는 삭제된 텍스트의 길이)
        // 삭제된 텍스트의 위치가 issue.source.startLine보다 위에 있으면 lineCount만큼 올린다
        lineCount = -(line2 - line1)
      } else {
        // 이 경우는 선택되어진 텍스트를 변경할때나 JSDoc 주석을 추가하는 경우등에 발생한다.
        // 라인이 추가될 수도 있고 삭제될 수도 있다.
        // 원래 텍스트의 라인 수와 변경된 텍스트의 라인 수를 비교한다.
        const deletedLineCount = line2 - line1
        const matchResult = change.text.match(/\n/g)
        const insertedLineCount = matchResult ? matchResult.filter(item => item !== '').length : 0
        lineCount = insertedLineCount - deletedLineCount
      }

      if (lineCount === 0) {
        return
      }
      console.log('🚀 ~ insert lines:', lineCount)
      const issues = PrismManager.findIssuesBySource(changeEvent.document.fileName)
      issues.forEach(issue => {
        if (issue.source.startLine > line1) {
          issue.source.startLine += lineCount
          issue.source.endLine += lineCount
          needUpdate = true
        }
      })
    })

    if (needUpdate) {
      PrismManager.updatePrism(prism)
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
  // [PrismItem의 this.command argument](/src\code-prism\PrismTreeProvider.ts#30-35) 참고
  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismFile.show', (item: PrismItem) => {
      PrismFileViewer.showPrismViewer(item.prism)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismFile.delete', async (item: PrismItem) => {
      const prism = item.prism
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

  // CodePrism.command.issue.addByContext 명령은 command palette, editor/context, editor/lineNumber/context 에서 발생한다.
  // command palette에서 발생하는 경우에는 인수가 없고
  // editor/context 에서 발생하는 경우에는 그냥 uri만 전달받으며
  // editor/lineNumber/context 에서 발생하는 경우에는 아래의 두 개체를 전달받는다.
  //   1) { uri, lineNumber }
  //   2) { preserveFocus: false } // 사용하지 않음
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'CodePrism.command.issue.addByContext',
      (arg: vscode.Uri | { uri: vscode.Uri; lineNumber: number } | undefined) => {
        if (!arg) {
          commentController.addIssueByContext()
        } else if (arg instanceof vscode.Uri) {
          commentController.addIssueByContext(arg)
        } else {
          commentController.addIssueByContext(arg.uri)
        }
      }
    )
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.issue.changePosition', (thread: vscode.CommentThread) => {
      commentController.changeIssuePosition(thread)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.issue.goto', (item: IssueItem) => {
      PrismFileViewer.showPrismViewer(item.prism, item.issue)
    })
  )

  // issue를 remove하는 것은 PrismCommentController, PrismTreeView, PrismView 이렇게 3곳에서 발생되는데
  // PrismCommentController, PrismTreeView에서 발생하는 것은 CodePrism.command.issue.delete 명령으로 처리된다.
  // 1) PrismTreeView의 IssueItem의 context menu에서 delete icon를 클릭 : "view/item/context" 참고
  // 2) Comment Controller의 thread context menu에서도 삭제할 수 있다 : "comments/commentThread/title" 참고
  // PrismView에서는 prism.removeNote() 직접 호출하고 이것에 의해 issue가 제거될 수도 있다.
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
          // 인수가 IssueItem이면 prism, issue를 바로 얻을 수 있지만 CommentThread이면
          // thread의 uri, contextValue(issue id가 저장되어져 있음)등을 통해서 찾아야 한다.
          const thread = threadOrItem as vscode.CommentThread
          const prismName = path.parse(thread!.uri.fsPath).name
          prism = PrismManager.getPrism(prismName)
          if (prism) {
            issue = prism.getIssue(thread.contextValue!)
          }
        }

        // 이 명령이 어디에서 호출되어졌는지에 관계없이 화면 갱신은 remove-issue에서 처리한다.
        if (prism && issue) {
          prism.removeIssue(issue.id)
          PrismManager.updatePrism(prism)
        }
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
    vscode.commands.registerCommand('CodePrism.command.note.delete', (comment: PrismComment) => {
      commentController.deleteNote(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.changeCategory', (comment: PrismComment) => {
      commentController.changeNoteCategory(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.makeMarkdown', (comment: PrismComment) => {
      commentController.makeMarkdown(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.edit', (comment: PrismComment) => {
      commentController.editNote(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.save', (comment: PrismComment) => {
      commentController.saveNote(comment)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.note.saveCancel', (comment: PrismComment) => {
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
      prismTreeProvider.refresh('tree', undefined)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.asList', () => {
      prismTreeProvider.refresh('list', undefined)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.sortByName', () => {
      prismTreeProvider.refresh(undefined, 'name')
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.sortByCategory', () => {
      prismTreeProvider.refresh(undefined, 'cate')
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.sortByCreation', () => {
      prismTreeProvider.refresh(undefined, 'time')
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('CodePrism.command.prismView.expandAll', async () => {
      const expandAllItems = async (item: PrismTreeViewElement) => {
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

  // load all Prism files
  const prisms = await PrismManager.loadPrismFiles()
  commentController.reload(prisms)
  prismTreeProvider.reload(prisms)

  output.log('activating is done')

  // // 나중에 테스트용으로 사용할 목적으로 남겨둔다.
  // vscode.commands.executeCommand('CodePrism.command.test')

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

  // vscode.commands.registerCommand('CodePrism.command.test', async () => {
  //   const commandArray = ['CodePrism.command.prismFile.show', 'CodePrism.command.prismFile.delete']
  //   const pickItems: vscode.QuickPickItem[] = commandArray.map(c => {
  //     return { label: c, description: c }
  //   })

  //   const selected = await vscode.window.showQuickPick(pickItems, {
  //     title: 'Command Actions of Code Prism',
  //     placeHolder: 'Select an command'
  //   })
  //   if (!selected) return

  //   switch (selected.label) {
  //     case 'CodePrism.command.prismFile.show':
  //       return vscode.commands.executeCommand(selected.label)
  //     default:
  //       return vscode.commands.executeCommand(selected.label)
  //   }
  // })
}
