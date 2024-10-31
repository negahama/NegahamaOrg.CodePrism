import * as vscode from 'vscode'
import * as path from 'path'

import { Issue, Prism } from './Prism'
import { PrismManager } from './PrismManager'
import { NoteDescription, PrismCommentController } from './PrismCommentController'
import { IssueItem, PrismItem, TreeElement, PrismTreeProvider } from './PrismTreeProvider'
import { PrismFileManager } from './PrismFileManager'
import { PrismViewer } from './PrismViewer'

/**
 * The `PrismCommands` class provides functionalities related to the Prism framework within the Visual Studio Code environment.
 * It manages comments, handles text document changes, and interacts with the Prism framework to create, update, and delete Prism files and issues.
 *
 * @class
 * @remarks
 * This class is responsible for:
 * - Managing an instance of `PrismFileProvider` to provide functionalities related to the Prism framework.
 * - Creating and managing a comment controller for handling comments in the editor.
 * - Subscribing to various events related to Prism and issues.
 * - Handling changes to text documents and updating issue positions accordingly.
 * - Creating, renaming, deleting, and showing Prism files.
 * - Adding, editing, saving, and deleting note descriptions.
 * - Loading Prism files and creating comment threads in the editor.
 * - Managing draft comments and updating note descriptions.
 */
export class PrismCommands {
  /**
   * An instance of `PrismProvider` used to manage and provide
   * functionalities related to the Prism framework within the application.
   */
  prismTreeProvider: PrismTreeProvider
  prismTreeView: vscode.TreeView<PrismItem>

  /**
   * An instance of `PrismCommentController` responsible for handling comment-related operations
   * within the Prism code documentation tool.
   */
  commentController: PrismCommentController

  /**
   * Constructs a new instance of the PrismCommands class.
   *
   * @param context - The VS Code extension context.
   *
   * Initializes the PrismFileProvider and registers it.
   * Initializes the PrismCommentController with the provided context.
   *
   * Note: Refer to [concept](/doc/concept.md) for more details.
   * The PrismFileProvider subscribes only to prism and issue events, not description events.
   *
   * Listens for text document changes in the workspace and handles them via the onChangeTextDocument method.
   */
  constructor(context: vscode.ExtensionContext) {
    this.prismTreeProvider = new PrismTreeProvider()
    this.prismTreeView = vscode.window.createTreeView('CodePrism.view.prismView', {
      treeDataProvider: this.prismTreeProvider,
    })
    context.subscriptions.push(this.prismTreeView)
    this.prismTreeProvider.register()

    this.commentController = new PrismCommentController(context)

    vscode.workspace.onDidChangeTextDocument(changeEvent => {
      this.onChangeTextDocument(changeEvent)
    })
  }

  /**
   * Handles changes to the text document and updates the positions of issues within prisms accordingly.
   *
   * @param changeEvent - The event that describes the change to the text document.
   *
   * This method performs the following actions:
   * - Iterates through all prisms and their issues to find issues associated with the changed document.
   * - Checks each change in the document to determine if text was added or deleted.
   * - If text was added and it includes new lines, it adjusts the start and end lines of affected issues.
   * - If text was deleted, it adjusts the start and end lines of affected issues.
   * - If any issues were updated, it triggers an update for all prisms.
   */
  onChangeTextDocument(changeEvent: vscode.TextDocumentChangeEvent) {
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
  }

  /**
   * Disposes of the comment controller if it exists.
   * This method should be called to clean up resources when the comment controller is no longer needed.
   */
  dispose() {
    this.commentController?.dispose()
  }

  /**
   * Asynchronously loads Prism files using the comment controller.
   *
   * @returns {Promise<void>} A promise that resolves when the Prism files are loaded.
   */
  async loadPrismFiles(): Promise<void> {
    const prisms = await PrismManager.loadPrismFiles()
    this.commentController.reload(prisms)
    this.prismTreeProvider.reload(prisms)
  }

  /**
   * Opens a prism file and its associated code and documentation files in VS Code.
   *
   * @param item - The prism item containing the label and URI of the prism file.
   *
   * This function performs the following steps:
   * 1. Logs the initiation of the `showPrismFile` function.
   * 2. Checks if the prism file exists using `PrismFileManager.isPrismFileExists`.
   *    - If the file does not exist, it shows a warning message and returns.
   * 3. Converts the item's URI to a VS Code URI and opens it.
   * 4. Reads and parses the prism file's JSON content.
   * 5. Constructs the file paths for the code and documentation files from the JSON content.
   * 6. Logs the constructed paths for debugging purposes.
   * 7. Converts the constructed paths to VS Code URIs.
   * 8. Opens the code and documentation files in VS Code.
   * 9. Opens a markdown preview for the documentation file.
   */
  showPrismFile(item: PrismItem) {
    PrismViewer.showPrismViewer(item.prism)
  }

  /**
   * Deletes a prism file after confirming with the user.
   *
   * @param item - The prism item to be deleted.
   * @returns {Promise<void>} A promise that resolves when the file is deleted.
   *
   * @remarks
   * This method first prompts the user with a warning message to confirm the deletion.
   * If the user confirms, it checks if the prism file exists. If the file exists, it proceeds
   * to delete the file and applies the workspace edit to reflect the deletion in the editor.
   * Finally, it refreshes the provider to update the UI.
   */
  async deletePrismFile(prism: Prism): Promise<void> {
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
  }

  /**
   * Adds a issue to the specified context.
   *
   * @param uri - The URI of the context where the issue should be added.
   */
  addIssueByContext(uri: vscode.Uri) {
    this.commentController.addIssueByContext(uri)
  }

  /**
   * Navigates to a specific issue in the Prism viewer.
   *
   * @param item - The issue item containing the prism and issue details.
   */
  gotoIssue(item: IssueItem) {
    PrismViewer.showPrismViewer(item.prism, item.issue)
  }

  /**
   * Deletes an issue from a prism or a comment thread.
   *
   * This method handles both `vscode.CommentThread` and `IssueItem` types.
   * If the input is an `IssueItem`, it extracts the associated prism and issue.
   * If the input is a `vscode.CommentThread`, it retrieves the prism by parsing
   * the thread's URI and then finds the issue by its title.
   *
   * Once the prism and issue are identified, the issue is removed from the prism
   * and the prism is updated. Finally, the comment thread or issue is disposed of
   * using the `commentController`.
   *
   * @param threadOrItem - The comment thread or issue item to be deleted.
   */
  deleteIssue(threadOrItem: vscode.CommentThread | IssueItem) {
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
        const title = thread.label?.trim() ?? ''
        issue = prism.getIssueByTitle(title)
      }
    }

    if (prism && issue) {
      prism.removeIssue(issue.id)
      PrismManager.updatePrism(prism)
    }

    // 아래 코드는 thread를 dispose하기 때문에 가장 마지막에 실행한다.
    this.commentController.deleteIssue(threadOrItem)
  }

  /**
   * Adds a note description to the comment controller.
   *
   * @param reply - The comment reply object containing the note description.
   * @returns A promise that resolves when the note description has been added.
   */
  async addNote(reply: vscode.CommentReply) {
    this.commentController.addNote(reply)
  }

  /**
   * Cancels the addition of a issue or note.
   *
   * @param reply - The description of the issue or note to be canceled.
   */
  cancelAddNote(reply: vscode.CommentReply) {
    this.commentController.cancelAddNote(reply)
  }

  /**
   * Edits the description of a issue.
   *
   * @param desc - The new description for the issue.
   */
  editNote(desc: NoteDescription) {
    this.commentController.editNote(desc)
  }

  /**
   * Deletes a note description.
   *
   * @param desc - The note description to be deleted.
   */
  deleteNote(desc: NoteDescription) {
    this.commentController.deleteNote(desc)
  }

  /**
   * Saves the provided note description.
   *
   * @param desc - The note description to be saved.
   */
  saveNote(desc: NoteDescription) {
    this.commentController.saveNote(desc)
  }

  /**
   * Cancels the save operation for a given note description.
   *
   * @param desc - The note description to cancel the save operation for.
   */
  cancelSaveNote(desc: NoteDescription) {
    this.commentController.cancelSaveNote(desc)
  }

  /**
   * Collapses the view in the Prism file provider.
   * This method triggers the collapse functionality of the prismFileProvider.
   */
  async collapseView() {
    const collapseAllItems = async (item: TreeElement) => {
      await this.prismTreeView.reveal(item, { expand: false, focus: false, select: false })
      const children = await this.prismTreeProvider.getChildren(item)
      if (children) {
        for (const child of children) {
          await collapseAllItems(child)
        }
      }
    }

    // 축소는 항목을 모두 새로 그려야만 하는 것으로 보인다.
    // reveal의 options의 expand는 항목이 표시될 때 항목을 확장할 것인지 여부이다. 숫자로 확장의 깊이를 지정할 수 있다.
    // 중요한 것은 expand가 false이면 항목이 확장되어져 표시되지 않을 뿐 이미 확장되어져 있는 것이 축소되는 것은 아니다.
    // const rootElements = await this.prismFileProvider.getChildren()
    // for (const rootElement of rootElements) {
    //   await collapseAllItems(rootElement)
    // }

    // this.prismFileProvider.refreshPrismView()

    // 아래의 expandAll command는 없다.
    // vscode.commands.executeCommand('workbench.actions.treeView.CodePrism.view.prismView.expandAll')
    vscode.commands.executeCommand('workbench.actions.treeView.CodePrism.view.prismView.collapseAll')
  }

  /**
   * Expands the view of the prism file.
   * This method calls the `expand` function of the `prismFileProvider` to expand the view.
   */
  async expandView() {
    const expandAllItems = async (item: TreeElement) => {
      await this.prismTreeView.reveal(item, { expand: true, focus: false, select: false })
      const children = await this.prismTreeProvider.getChildren(item)
      if (children) {
        for (const child of children) {
          await expandAllItems(child)
        }
      }
    }

    // item을 확장하는 것은 reveal을 통해서 할 수 있다.
    // expand를 지정해 reveal을 호출하더라도 element.collapsibleState의 값은 전혀 변경되지 않는다.
    // 또한 element.collapsibleState를 변경하더라도 이것 자체로 확장, 축소가 화면에 반영되는 것도 아니다.
    const rootElements = await this.prismTreeProvider.getChildren()
    for (const rootElement of rootElements) {
      await expandAllItems(rootElement)
    }

    this.prismTreeProvider.refreshPrismView()
  }

  /**
   * Refreshes the view by invoking the refresh method on the prismProvider.
   * This method ensures that the current state of the view is updated.
   */
  reloadView() {
    this.prismTreeProvider.reload()
  }
}
