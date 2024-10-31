import * as vscode from 'vscode'
import * as path from 'path'

import { Note, Prism, uuid } from './Prism'
import { PrismManager, SubscribeType } from './PrismManager'
import { PrismFileManager } from './PrismFileManager'
import { convertLink } from './PrismLinkDetector'
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
 * @method addIssueByContext - Adds a issue to the active text editor at the specified line and column.
 * @method deleteIssue - Deletes a issue associated with the given comment thread.
 * @method addNote - Adds a description to a issue within a comment thread.
 * @method cancelAddNote - Cancels the addition of a issue or note comment by removing it from the thread.
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
        const comments = issue.notes.map(note => this.convertNoteToComment(note))

        // 파일에 저장된 source의 line은 1 base이므로 실제 사용값인 0 base로 변경한다.
        const thread = this.commentController.createCommentThread(
          vscode.Uri.file(PrismFileManager.getWorkspacePath() + issue.source.file),
          new vscode.Range(
            new vscode.Position(issue.source.startLine - 1, issue.source.startColumn),
            new vscode.Position(issue.source.endLine - 1, issue.source.endColumn)
          ),
          comments
        )

        // comment의 thread는 여기서 설정한다.
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
   * Adds an issue to the Prism context based on the current selection in the active text editor.
   * If no text is selected, it uses the word under the cursor or the entire line if no word is found.
   * The issue is then appended to the corresponding Prism file, and a comment thread is created.
   *
   * @param uri - The URI of the file where the issue is being added.
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

    // comment의 thread는 thread를 생성한 후 설정한다.
    const comment = this.convertNoteToComment(note)

    // 이것 실제 사용되는 position이므로 0 base이므로 변경하지 않는다.
    const thread = this.commentController.createCommentThread(vscode.Uri.file(source), range, [comment])
    thread.label = title.trim()
    comment.thread = thread

    if (this.commentThreads.has(prismName)) {
      this.commentThreads.get(prismName)?.push(thread)
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
    vscode.window.showInformationMessage(`add note: ${reply.text}`)

    const note = Prism.getDefaultNote(reply.text)
    const body = new vscode.MarkdownString(convertLink(reply.text))

    const newComment = new NoteDescription(
      note.category,
      body,
      vscode.CommentMode.Preview,
      note.createdAt,
      reply.thread
    )
    reply.thread.comments = [...reply.thread.comments, newComment]

    const prismName = path.parse(reply.thread.uri.fsPath).name

    // addNote는 새로운 thread의 추가도 처리한다.
    // comment controller에서는 comment와 thread를 처리의 목적에 따라서 자연스럽게 관리하고 있기 때문에
    // 즉 comment와 thread를 따로따로 생성하지 않고 comment가 처음 추가되는 경우 thread도 같이 생성해 주기 때문에
    // 여기서도 같은 방식으로 note를 추가할 때 thread, issue가 생성되어지지 않은 경우라면 생성까지 같이 처리한다.
    // 이때 기존에 생성되어져 있는 thread와 새로 생성된 thread(처음 comment를 추가하려는 thread)를 구분할 수 있어야 한다.
    const threads = this.commentThreads.get(prismName)
    if (!threads) {
      console.warn(`No comment thread: ${prismName}`)
    } else {
      if (!threads.find(thread => thread === reply.thread)) {
        threads.push(reply.thread)
      }
    }

    // prism이 없으면 새로 만든다.
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

    const newContent = this.extractLinkFromNoteContent(note)

    prism.appendNote(issue.id, { ...note, content: newContent })
    PrismManager.updatePrism(prism)
  }

  /**
   * Cancels the addition of a note in a comment thread.
   *
   * This method handles both issues and threads similarly to the `addNote` method.
   * Unlike `deleteIssue` which deletes an existing issue, and `deleteNote` which deletes an existing note,
   * this method deals with cases where the issue or note might not yet exist and is not strictly a deletion.
   * However, there might be cases where cancellation necessitates deletion.
   *
   * If the thread does not exist, a warning is logged and the method returns early.
   *
   * If a note addition is cancelled, no further action is required.
   * However, if this is the initial comment being added to the thread, the thread itself is disposed of.
   * The determination of whether it is the initial comment is based on the length of `thread.comments`.
   *
   * @param reply - The `vscode.CommentReply` object containing the thread to be cancelled.
   */
  cancelAddNote(reply: vscode.CommentReply) {
    // addNote와 마찬가지로 Issue와 Thread를 같이 처리한다.
    // deleteIssue는 이미 존재하는 issue를 삭제하는 것이고 deleteNote도 이미 존재하는 note를 삭제하는 것인데 반해서
    // 이것은 issue나 note가 아직 존재하지 않을 수도 있고 엄밀히 삭제하는 것도 아니다.
    // 하지만 cancel됨으로써 삭제를 해야 하는 경우도 있을 수 있다.
    const thread = reply.thread
    if (!thread) {
      console.warn('error in cancelAddNote: No thread')
      return
    }

    // note를 추가하려다 취소한 경우에는 별도로 처리할 것이 없다.
    // 하지만 이것이 처음 comment를 추가하려는 경우라면 thread를 삭제해야 한다.
    // 처음 comment를 추가하려는 경우인지의 여부는 thread.comments.length로 확인한다.
    if (thread.comments.length === 0) {
      thread.dispose()
    }
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
      note.content = typeof found.body === 'string' ? found.body : found.body.value
    }

    const newContent = this.extractLinkFromNoteContent(note)

    prism.updateNote(issue.id, { ...note, content: newContent })
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
   * Converts a `Note` object to a `NoteDescription` object.
   *
   * This method transforms a `Note` into a `NoteDescription` suitable for use in a comment system.
   * It appends additional issue information (e.g., links) to the comment body.
   *
   * @param note - The `Note` object to be converted.
   * @returns A `NoteDescription` object containing the converted note data.
   */
  private convertNoteToComment(note: Note): NoteDescription {
    // note를 comment로 변환한다.
    // 이때 comment에는 표시되지 않는 issue의 정보(예를들면 link)를 comment.body에 추가한다.
    // 또 note의 body에 있는 링크 정보를 절대 경로로 변환해 준다.(comment에서는 상대 경로를 지원하지 않음)
    const contents = this.appendLinkToNoteContent(note)
    const body = new vscode.MarkdownString(convertLink(contents))
    return {
      kind: note.category,
      body,
      mode: vscode.CommentMode.Preview,
      // thread는 나중에 설정한다.
      id: note.id,
      label: note.createdAt,
      savedBody: body,
      author: { name: note.category },
    }
  }

  /**
   * Appends a link to the note's body if it exists and ensures that the link is in an absolute path format.
   *
   * This method performs the following steps:
   * 1. Extracts any existing links from the note's body and removes them.
   * 2. If the note has a link, it processes the link to ensure it is in an absolute path format.
   * 3. Adds the processed link to the result array in a markdown format.
   *
   * @param note - The note object which may contain a link and body information.
   * @returns A string representing the modified note body with the appended link.
   */
  private appendLinkToNoteContent(note: Note) {
    // comment controlller에서는 note의 링크가 표시되어지지 않기 때문에 이를 body에 추가해서 표시한다.
    // 또한 note.content에서 지정한 문서들의 링크도 표시 문제로 절대 경로로 변경해서 저장해야 한다.
    const result: string[] = []

    // 필요없다고 생각하지만 note.content에 이미 변환된 내용이 있는지 확인하고 있으면 제거한다.
    result.push(this.extractLinkFromNoteContent(note))

    // comment controller의 입력창에서 설정하는 링크는 이것이 비록 마크다운 형태로 처리되어도 `file:///절대경로` 만 인식한다.
    if (note.link) {
      let root = PrismFileManager.getWorkspacePath() ?? ''
      let link = note.link.replace('file:///', '')
      if (link.startsWith('./')) {
        // prism folder에서의 상대 경로인 경우에는...
        // 이 링크가 prism file에 저장되어져 있기 때문에 여기서 현재 폴더는 prism folder이다.
        root = PrismFileManager.getPrismFolderPath()
      }

      // string으로 저장할시에는 \를 /로 변경해야 한다. 그렇지 않으면 . 으로 시작하는 폴더가 상위 폴더와 분리가 되지 않는다.
      link = path.join(root, link).replaceAll('\\', '/')

      result.push('\n\n\n---')
      result.push('_Modifing this section is useless!_')
      result.push(`- [linked document - ${note.link}](file:///${link})`)
    }

    return result.join('\n')
  }

  /**
   * Extracts the original content from a note's body by removing any appended
   * link information. If the body contains a specific marker indicating the
   * start of the appended link information, the method will return the content
   * before this marker.
   *
   * @param note - The note object containing the body to be processed.
   * @returns The original content of the note's body without the appended link information.
   */
  private extractLinkFromNoteContent(note: Note) {
    // note.content에 이미 변환된 내용이 있는지 확인하고 있으면 제거한다.
    let original = note.content
    const index = note.content.indexOf('\n---\n_Modifing this section is useless!_\n- [linked document -')
    if (index > 0) {
      original = note.content.slice(0, index)
    }
    return original
  }
}
