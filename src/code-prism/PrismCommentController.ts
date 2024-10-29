import * as vscode from 'vscode'
import * as path from 'path'

import { Prism, uuid } from './Prism'
import { PrismManager, SubscribeType } from './PrismManager'
import { PrismFileManager } from './PrismFileManager'
import { IssueItem } from './PrismTreeProvider'
import { output } from './PrismOutputChannel'

/**
 * Represents a issue comment in a VS Code extension.
 * Implements the `vscode.Comment` interface.
 * id, label, savedBody, thread가 추가하였다.
 */
export class NoteDescription implements vscode.Comment {
  /**
   * Unique identifier for the comment.
   */
  id: string

  /**
   * The saved body of the comment, used for the Cancel button.
   */
  savedBody: string | vscode.MarkdownString

  /**
   * 원래는 information about the author of a comment 이지만 여기서는 type of comment로 쓰인다.
   * 이유는 Code Prism에서는 author가 의미가 없을 뿐만 아니라 comment panel에서 author의 이름이 가장 먼저 표시되기 때문이다.
   *
   * @property {string} name - The name of the author.
   * @property {string} [iconPath] - An optional path to the author's icon.
   */
  author: vscode.CommentAuthorInformation

  /**
   * Constructs a new instance of the PrismCommands class.
   *
   * @param kind - The kind of the command.
   * @param body - The body of the command, which can be a string or a vscode.MarkdownString.
   * @param mode - The mode of the comment.
   * @param label - (Optional) The label for the command.
   * @param thread - (Optional) The comment thread associated with the command.
   */
  constructor(
    public kind: string,
    public body: string | vscode.MarkdownString,
    public mode: vscode.CommentMode,
    public label?: string,
    public thread?: vscode.CommentThread
  ) {
    this.id = uuid()
    this.savedBody = this.body
    this.author = { name: kind }
  }
}

/**
 * The `PrismCommentController` class is responsible for managing comments within the Visual Studio Code environment.
 * This controller facilitates the creation, modification, and deletion of comments in the editor.
 *
 * @class PrismCommentController
 * @property {vscode.CommentController} commentController - The controller for managing comments.
 * @property {Map<string, vscode.CommentThread[]>} commentThreads - A map that associates a string key with an array of VS Code comment threads.
 *
 * @constructor
 * @param {vscode.ExtensionContext} context - The extension context provided by VS Code.
 *
 * @method dispose - Disposes of the comment controller if it exists.
 * @method reload - Asynchronously loads Prism files and initializes comment threads for each issue.
 * @method addIssueByController - Adds a issue to the active text editor at the specified line and column.
 * @method addIssueByContext - Adds a issue to the active text editor at the specified line and column.
 * @method cancelAddIssue - Cancels the addition of a issue comment by removing it from the thread.
 * @method deleteIssue - Deletes a issue associated with the given comment thread.
 * @method addNote - Adds a description to a issue within a comment thread.
 * @method editNote - Edits a issue comment by setting its mode to `Editing`.
 * @method deleteNote - Deletes a issue comment from its thread.
 * @method saveNote - Saves the body of a issue comment and updates its mode to preview.
 * @method cancelSaveNote - Cancels the save operation for a issue comment by restoring its original body and setting its mode to preview.
 */
export class PrismCommentController {
  /**
   * The controller for managing comments within the Visual Studio Code environment.
   * This controller allows for the creation, modification, and deletion of comments
   * in the editor.
   *
   * @type {vscode.CommentController}
   */
  commentController: vscode.CommentController

  /**
   * A map that associates a string key with an array of VS Code comment threads.
   * key is the name of the prism
   *
   * @type {Map<string, vscode.CommentThread[]>}
   */
  commentThreads: Map<string, vscode.CommentThread[]> = new Map()

  /**
   * Creates an instance of PrismCommentController.
   *
   * @param context - The extension context provided by VS Code.
   *
   * This constructor initializes the comment controller for the 'code-prism-issue-tracker' and sets up the commenting range provider.
   * It also subscribes to various events from the PrismManager to handle comment creation, description appending, description updating, and description removal.
   *
   * Subscriptions:
   * - 'create-prism': Handles the creation of a new prism (TODO: Implement functionality).
   * - 'append-note': Handles appending a description to a prism (TODO: Implement functionality).
   * - 'update-note': Handles updating a description of a prism (TODO: Implement functionality).
   * - 'remove-note': Handles removing a description from a prism. It iterates through all comment threads and removes the comment that matches the description ID.
   */
  constructor(context: vscode.ExtensionContext) {
    this.commentController = vscode.comments.createCommentController(
      'code-prism-issue-tracker',
      'Prism Comment Controller'
    )
    context.subscriptions.push(this.commentController)

    // 이것을 지정하지 않으면 `reply...` 으로 표시된다.
    this.commentController.options = {
      prompt: 'append new note...',
      placeHolder: 'append new note...',
    }

    // A `CommentingRangeProvider` controls where gutter decorations that allow adding comments are shown
    this.commentController.commentingRangeProvider = {
      provideCommentingRanges: (document: vscode.TextDocument, token: vscode.CancellationToken) => {
        const lineCount = document.lineCount
        return [new vscode.Range(0, 0, lineCount - 1, 0)]
      },
    }

    // CommentController의 구독을 처리한다.
    PrismManager.subscribe('append-note', (data: SubscribeType) => {
      //todo
    })

    PrismManager.subscribe('update-note', (data: SubscribeType) => {
      //todo
    })

    PrismManager.subscribe('remove-note', (data: SubscribeType) => {
      this.commentThreads.forEach(ta => {
        ta.forEach(thread => {
          const found = thread.comments.find(cmt => (cmt as NoteDescription).id === data.note?.id)
          if (found) {
            thread.comments = thread.comments.filter(cmt => cmt !== found)
          }
        })
      })
    })
  }

  /**
   * Disposes of the comment controller if it exists.
   * This method should be called to clean up resources when the comment controller is no longer needed.
   */
  dispose() {
    this.commentController?.dispose()
  }

  /**
   * Asynchronously loads Prism files and initializes comment threads for each issue.
   *
   * This method performs the following steps:
   * 1. Logs the start of the loading process.
   * 2. Loads the Prism files using `PrismManager.loadPrismFiles()`.
   * 3. Logs the count of loaded Prism files.
   * 4. Iterates over each loaded Prism file and logs its name and issue count.
   * 5. Initializes an empty array for comment threads for each Prism.
   * 6. For each issue in the Prism, creates comments from note descriptions and initializes a comment thread.
   * 7. Sets the label for each thread and associates comments with their respective threads.
   * 8. Adds the created comment thread to the `commentThreads` map.
   * 9. Logs the completion of the loading process.
   *
   * @returns {Promise<void>} A promise that resolves when the loading process is complete.
   */
  async reload(prisms?: Prism[]): Promise<void> {
    output.log('Loading Prism files...')

    if (!prisms) {
      prisms = await PrismManager.loadPrismFiles()
    }
    output.log(`prisms's count: ${prisms.length}`)

    prisms.forEach(prism => {
      output.log(`  prism: ${prism.name}, issue's count: ${prism.getIssuesCount()}`)

      this.commentThreads.set(prism.name, [])

      prism.issues.forEach(async (issue): Promise<void> => {
        const comments = issue.notes.map(note => {
          return {
            kind: note.category,
            body: new vscode.MarkdownString(note.context),
            mode: vscode.CommentMode.Preview,
            // thread는 나중에 설정한다.
            id: note.id,
            label: note.createdAt,
            savedBody: note.context,
            author: { name: note.category },
          }
        })

        // 파일에 저장된 source의 line은 1 base이므로 실제 사용값인 0 base로 변경한다.
        const thread = this.commentController.createCommentThread(
          vscode.Uri.file(PrismFileManager.getWorkspacePath() + issue.source.file),
          new vscode.Range(
            new vscode.Position(issue.source.startLine - 1, issue.source.startColumn),
            new vscode.Position(issue.source.endLine - 1, issue.source.endColumn)
          ),
          comments
        )

        thread.label = issue.title.trim()
        thread.comments.forEach(cmt => {
          const comment = cmt as NoteDescription
          comment.thread = thread
        })

        if (this.commentThreads.has(prism.name)) {
          this.commentThreads.get(prism.name)?.push(thread)
        }
      })
    })
    output.log('Loading Prism files... Done')
  }

  /**
   *
   * @param reply
   * @returns
   */
  async addIssueByController(reply: vscode.CommentReply) {
    vscode.window.showInformationMessage(`addIssueByController: ${reply.text}`)

    const note = Prism.getDefaultNote(reply.text)

    const newComment = new NoteDescription(
      note.category,
      reply.text,
      vscode.CommentMode.Preview,
      note.createdAt,
      reply.thread
    )
    reply.thread.comments = [...reply.thread.comments, newComment]

    const prismName = path.parse(reply.thread.uri.fsPath).name

    // 이미 thread가 존재하므로 thread 중복 여부만 검사하고 추가해 준다.
    //todo 이미 존재하는 thread가 아니라고 가정하고 있다.
    if (this.commentThreads.has(prismName)) {
      this.commentThreads.get(prismName)?.push(reply.thread)
    }

    // prism이 없으면 새로 만든다.
    const prism = PrismManager.getPrism(prismName, true)
    if (!prism) {
      vscode.window.showErrorMessage('Failed to get Prism: ' + prismName)
      return
    }

    const title = await this.getThreadTitle(reply.thread)
    reply.thread.label = title

    // issue가 없으면 새로 만든다.
    let issue = prism.getIssueByTitle(title)
    if (!issue) {
      const source = reply.thread.uri.fsPath
      prism.appendIssueDetails(title, source, reply.thread.range)
      issue = prism.getIssueByTitle(title)
    }
    if (!issue) {
      return
    }

    prism.appendNote(issue.id, note)
    PrismManager.updatePrism(prism)
  }

  /**
   * Retrieves the label for a given comment thread. If the thread does not have a label,
   * it attempts to extract the label from the text document at the thread's location.
   * If no label is found, it returns a default label.
   *
   * @param thread - The comment thread for which to retrieve the label.
   * @returns A promise that resolves to the label of the comment thread.
   */
  private async getThreadTitle(thread: vscode.CommentThread): Promise<string> {
    let title = thread.label
    if (!title) {
      await vscode.workspace.openTextDocument(thread.uri).then(doc => {
        const range = doc.lineAt(thread.range.start.line).range
        title = doc.getText(range) + ' in ' + thread.uri.fsPath + '#' + (thread.range.start.line + 1)
      })
    }
    if (!title) {
      return '# No title'
    }

    return title.trim()
  }

  /**
   * Adds a issue to the active text editor at the specified line and column.
   * If no text is selected, the issue is added at the current cursor position.
   * If text is selected, the issue is added at the start of the selection.
   * The issue is associated with a prism, which is created if it does not already exist.
   *
   * @param arg - The context parameters for the editor line number.
   *
   * The function performs the following steps:
   * 1. Checks if there is an active text editor.
   * 2. Determines the line, column, and title of the issue based on the current selection.
   * 3. Creates a comment thread with the issue.
   * 4. Associates the issue with a prism, creating the prism if necessary.
   * 5. Updates the prism file and refreshes the prism view.
   */
  addIssueByContext(uri: vscode.Uri) {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      console.log('No active text editor')
      return
    }

    let title: string
    let range: vscode.Range

    if (editor.selection.isEmpty) {
      const position = editor.selection.active
      const wordRange = editor.document.getWordRangeAtPosition(position)
      if (wordRange) {
        title = editor.document.getText(wordRange)
        range = wordRange
      } else {
        const line = editor.selection.active.line
        range = editor.document.lineAt(line).range
        title = editor.document.getText(range)
      }
    } else {
      range = editor.selection
      if (range.end.line === range.start.line) {
        title = editor.document.getText(range)
      } else {
        // Suppose the top line in multiple lines selection is function name
        title = editor.document.getText(editor.document.lineAt(range.end.line).range)
      }
    }

    title += ' in ' + uri.fsPath + '#' + (range.start.line + 1)
    title = title.trim()

    // prism folder의 존재 여부와 상관없이 생성할 수 있다.
    const editFileName = editor.document.fileName
    if (!editFileName) {
      vscode.window.showWarningMessage('You need to select(activate) the source code which you want to')
      return
    }

    const prismName = path.parse(editFileName).name
    vscode.window.showInformationMessage(`prismFileName: ${prismName}`)
    if (prismName === undefined) {
      vscode.window.showWarningMessage('Multiple prism files are too much for Homo sapiens.')
      return
    }

    // prism이 없으면 새로 만든다.
    const prism = PrismManager.getPrism(prismName, true)
    if (!prism) {
      vscode.window.showErrorMessage('Failed to get Prism: ' + prismName)
      return
    }

    // issue가 없으면 새로 만든다.
    const source = editor.document.fileName
    let issue = prism.getIssueByTitle(title)
    if (!issue) {
      prism.appendIssueDetails(title, source, range)
      issue = prism.getIssueByTitle(title)
    }
    if (!issue) {
      return
    }

    // 주석 추가
    const note = Prism.getDefaultNote()

    prism.appendNote(issue.id, note)
    PrismManager.updatePrism(prism)

    const comment: NoteDescription = {
      kind: note.category,
      body: new vscode.MarkdownString(note.context),
      mode: vscode.CommentMode.Preview,
      // thread는 나중에 설정한다.
      id: note.id,
      label: note.createdAt,
      savedBody: note.context,
      author: { name: note.category },
    }

    // 이것 실제 사용되는 position이므로 0 base이므로 변경하지 않는다.
    const thread = this.commentController.createCommentThread(vscode.Uri.file(source), range, [comment])
    thread.label = title.trim()
    comment.thread = thread

    if (this.commentThreads.has(prismName)) {
      this.commentThreads.get(prismName)?.push(thread)
    }
  }

  /**
   * Cancels the addition of a issue comment by removing it from the thread.
   * If the thread has no more comments after removal, it disposes of the thread.
   *
   * @param desc - The issue comment to be removed.
   */
  cancelAddIssue(desc: NoteDescription) {
    const thread = desc.thread
    if (!thread) {
      return
    }
    thread.comments = thread.comments.filter(cmt => (cmt as NoteDescription).id !== desc.id)

    if (thread.comments.length === 0) {
      thread.dispose()
    }
  }

  /**
   * Deletes a comment thread or an issue item.
   *
   * @param threadOrItem - The comment thread or issue item to be deleted.
   * threadOrItem이 vscode.CommentThread인 것은 당연하지만 IssueItem 대신 다른 것(예를들면 Issue)을 사용할 수도 있는데
   * 이를 유지하는 것은 instanceof를 사용할 때 CommentThread나 Issue를 사용할 수 없기 때문이다.
   *
   * If the parameter is an `IssueItem`, the method will find the corresponding comment thread by matching the issue title with the thread label and dispose of it.
   * If the parameter is a `vscode.CommentThread`, it will directly dispose of the thread.
   *
   * After disposing of the thread, it will remove the thread from the `commentThreads` collection.
   */
  deleteIssue(threadOrItem: vscode.CommentThread | IssueItem) {
    let deletedThread: vscode.CommentThread | undefined

    if (threadOrItem instanceof IssueItem) {
      const item = threadOrItem as IssueItem
      this.commentThreads.get(item.prism.name)?.forEach(thread => {
        if (thread.label === item.issue.title) {
          deletedThread = thread
          thread.dispose()
        }
      })
    } else {
      deletedThread = threadOrItem as vscode.CommentThread
      deletedThread.dispose()
    }

    if (deletedThread) {
      this.commentThreads.forEach(ta => {
        ta.forEach((thread, index) => {
          if (thread === deletedThread) {
            ta.splice(index, 1)
          }
        })
      })
    }
  }

  /**
   * Adds a description to a issue within a comment thread.
   *
   * This function extracts details from the provided `vscode.CommentReply` object,
   * creates a new `issueComment`, and appends it to the comment thread. It also
   * updates or creates a Prism file with the issue details.
   *
   * @param reply - The comment reply object containing the text and thread information.
   *
   * The function performs the following steps:
   * 1. Extracts the prism name, title, source file path, line number, and column number from the reply.
   * 2. Creates a new `issueComment` and appends it to the comment thread.
   * 3. Checks if a Prism file exists for the extracted prism name:
   *    - If it exists, it updates the Prism file with the new issue details.
   *    - If it does not exist, it creates a new Prism file, adds the issue, and updates the file.
   * 4. Refreshes the Prism view in the UI.
   */
  async addNote(reply: vscode.CommentReply) {
    const note = Prism.getDefaultNote(reply.text)

    const newComment = new NoteDescription(
      note.category,
      reply.text,
      vscode.CommentMode.Preview,
      note.createdAt,
      reply.thread
    )
    reply.thread.comments = [...reply.thread.comments, newComment]

    // prism이 없으면 새로 만든다.
    const prismName = path.parse(reply.thread.uri.fsPath).name
    const prism = PrismManager.getPrism(prismName, true)
    if (!prism) {
      vscode.window.showErrorMessage('Failed to get Prism: ' + prismName)
      return
    }

    const title = await this.getThreadTitle(reply.thread)

    // issue가 없으면 새로 만든다.
    let issue = prism.getIssueByTitle(title)
    if (!issue) {
      const source = reply.thread.uri.fsPath
      prism.appendIssueDetails(title, source, reply.thread.range)
      issue = prism.getIssueByTitle(title)
    }
    if (!issue) {
      return
    }

    prism.appendNote(issue.id, note)
    PrismManager.updatePrism(prism)
  }

  /**
   * Edits the description of a issue by setting the mode of the corresponding comment to editing.
   *
   * @param desc - The note description object containing the thread and comments.
   */
  editNote(desc: NoteDescription) {
    if (!desc.thread) {
      return
    }

    desc.thread.comments = desc.thread.comments.map(cmt => {
      if ((cmt as NoteDescription).id === desc.id) {
        cmt.mode = vscode.CommentMode.Editing
      }

      return cmt
    })
  }

  /**
   * Deletes a issue comment from its thread. If the thread becomes empty after the deletion,
   * the thread is disposed of.
   *
   * @param desc - The issue comment to be deleted.
   */
  deleteNote(desc: NoteDescription) {
    const thread = desc.thread
    if (!thread) {
      console.warn('error in deleteNote: No thread')
      return
    }

    thread.comments = thread.comments.filter(cmt => (cmt as NoteDescription).id !== desc.id)

    const prismName = path.parse(thread.uri.fsPath).name
    const prism = PrismManager.getPrism(prismName)
    if (!prism) {
      console.warn('error in deleteNote: No prism')
      return
    }

    const issueTitle = thread.label?.trim() ?? ''
    const issue = prism.getIssueByTitle(issueTitle)
    if (!issue) {
      console.warn('error in deleteNote: No issue')
      return
    }

    const note = issue.notes.find(n => n.id === desc.id)
    if (!note) {
      console.warn('error in deleteNote: No note')
      return
    }

    prism.removeNote(issue.id, note.id)

    issue.notes = issue.notes.filter(n => n.id !== desc.id)
    if (issue.notes === undefined || issue.notes.length === 0) {
      prism.removeIssue(issue.id)
    }

    PrismManager.updatePrism(prism)

    if (thread.comments.length === 0) {
      thread.dispose()
    }
  }

  /**
   * Saves the body of a issue comment and updates its mode to preview.
   *
   * @param desc - The issue comment to be saved. It should contain a thread with comments.
   *
   * This function iterates through the comments in the thread and updates the comment
   * that matches the given comment's ID. The body of the comment is saved to `savedBody`
   * and the mode is set to `vscode.CommentMode.Preview`.
   */
  saveNote(desc: NoteDescription) {
    const thread = desc.thread
    if (!thread) {
      console.warn('error in saveNote: No thread')
      return
    }

    // comments에 있는 comment만 변경해서는 반영이 되지 않는다. comments를 새로 생성해야 한다.
    // prism 관련 에러와 관계없이 이건 처리되게 한다.
    let found: vscode.Comment | undefined
    thread.comments = thread.comments.map(c => {
      const cmt = c as NoteDescription
      if (cmt.id === desc.id) {
        cmt.savedBody = cmt.body
        cmt.mode = vscode.CommentMode.Preview
        found = cmt
      }
      return cmt
    })

    const prismName = path.parse(thread.uri.fsPath).name
    const prism = PrismManager.getPrism(prismName)
    if (!prism) {
      console.warn('error in saveNote: No prism')
      return
    }

    const issueTitle = thread.label?.trim() ?? ''
    const issue = prism.getIssueByTitle(issueTitle)
    if (!issue) {
      console.warn('error in saveNote: No issue')
      return
    }

    const note = issue.notes.find(n => n.id === desc.id)
    if (!note) {
      console.warn('error in saveNote: No note')
      return
    }

    if (found) {
      note.context = typeof found.body === 'string' ? found.body : found.body.value
    }

    prism.updateNote(issue.id, note)
    PrismManager.updatePrism(prism)
  }

  /**
   * Cancels the save operation for a issue comment by restoring its original body and setting its mode to preview.
   *
   * @param desc - The issue comment to cancel the save operation for.
   */
  cancelSaveNote(desc: NoteDescription) {
    const thread = desc.thread
    if (!thread) {
      return
    }

    thread.comments = thread.comments.map(c => {
      const cmt = c as NoteDescription
      if (cmt.id === desc.id) {
        cmt.body = cmt.savedBody
        cmt.mode = vscode.CommentMode.Preview
      }
      return cmt
    })
  }
}
