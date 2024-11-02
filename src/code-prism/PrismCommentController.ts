import * as vscode from 'vscode'
import * as path from 'path'

import { Issue, Note, Prism } from './Prism'
import { PrismManager, SubscribeType } from './PrismManager'
import { PrismFileManager } from './PrismFileManager'
import { convertLink } from './PrismLinkDetector'
import { IssueItem } from './PrismTreeProvider'
import { output } from './PrismOutputChannel'

/**
 * Creates an author information object for a comment.
 *
 * @param name - The name of the author.
 * @returns An object containing the author's name and icon path.
 */
function createAuthor(name: string): vscode.CommentAuthorInformation {
  const iconPath = vscode.Uri.parse('https://img.icons8.com/color/48/virtualbox.png')
  return { name, iconPath }
}

/**
 * Represents a issue comment in a VS Code extension.
 * Implements the `vscode.Comment` interface.
 * id, label, savedBody, thread가 추가하였다.
 */
export class NoteDescription implements vscode.Comment {
  /**
   * 이 Id는 이 개체와 연결된 note의 id이다.
   */
  id: string

  /**
   * 원래는 information about the author of a comment 이지만 여기서는 type of comment로 쓰인다.
   * 이유는 Code Prism에서는 author가 의미가 없을 뿐만 아니라 comment panel에서 author의 이름이 가장 먼저 표시되기 때문이다.
   *
   * @property {string} name - The name of the author.
   * @property {string} [iconPath] - An optional path to the author's icon.
   */
  author: vscode.CommentAuthorInformation

  /**
   * A label associated with the PrismCommentController.
   * This label is used to identify or describe the controller.
   */
  label: string

  /**
   * The saved body of the comment, used for the Cancel button.
   */
  savedBody: string | vscode.MarkdownString

  /**
   * Represents the context value associated with this instance.
   * This value is used to determine the context in which this instance operates.
   */
  contextValue: string

  /**
   * Constructs a new instance of the PrismCommands class.
   *
   * @param note
   * @param body - The body of the command, which can be a string or a vscode.MarkdownString.
   * @param mode - The mode of the comment.
   * @param thread - (Optional) The comment thread associated with the command.
   */
  constructor(
    // note는 다른 properties를 설정하기 위해서 오로지 생성자에서만 사용된다.
    // 왜 그런지는 모르겠지만 여기서의 note는 복사되어지는 것으로 보인다.
    // 즉 PrismManager에서 같은 note를 변경해도 여기서 변경되지 않는다.
    private note: Note,
    public body: string | vscode.MarkdownString,
    public mode: vscode.CommentMode,
    public thread?: vscode.CommentThread
  ) {
    this.id = note.id
    this.author = createAuthor(note.category)
    this.label = note.createdAt
    this.savedBody = this.body
    this.contextValue = note.link ? 'have-link' : 'no-link'
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

    // this.commentController.reactionHandler = (
    //   comment: vscode.Comment,
    //   reaction: vscode.CommentReaction
    // ): Thenable<void> => {
    //   vscode.window.showInformationMessage('reaction: ' + reaction.label)
    //   return Promise.resolve()
    // }

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
        const comments = issue.notes.map(note => this.createNoteDescription(note))

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
        thread.contextValue = issue.id
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

    const source = editor.document.fileName
    const prismName = path.parse(source).name
    if (!prismName) {
      vscode.window.showWarningMessage('You need to select(activate) the source code which you want to')
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

    // prism이 없으면 새로 만든다.
    const prism = PrismManager.getPrism(prismName, true)
    if (!prism) {
      vscode.window.showErrorMessage('Failed to get Prism: ' + prismName)
      return
    }

    // context menu에서 issue를 추가할 때는 이미 issue가 있는지를 title말고 다른 것으로는 알 방법이 없다.
    // issue가 없으면 새로 만든다.
    let issue = prism.getIssueByTitle(title)
    if (!issue) {
      issue = prism.appendIssueDetails(title, source, range)
    }

    // 주석 추가
    const note = Prism.getDefaultNote()

    prism.appendNote(issue.id, note)
    PrismManager.updatePrism(prism)

    // comment의 thread는 thread를 생성한 후 설정한다.
    const comment = this.createNoteDescription(note)

    // 이것 실제 사용되는 position이므로 0 base이므로 변경하지 않는다.
    const thread = this.commentController.createCommentThread(vscode.Uri.file(source), range, [comment])
    thread.label = title.trim()
    thread.contextValue = issue.id
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

    // addNote는 새로운 thread의 추가도 처리한다.
    // comment controller에서는 comment와 thread를 처리의 목적에 따라서 자연스럽게 관리하고 있기 때문에
    // 즉 comment와 thread를 따로따로 생성하지 않고 comment가 처음 추가되는 경우 thread도 같이 생성해 주기 때문에
    // 여기서도 같은 방식으로 note를 추가할 때 thread, issue가 생성되어지지 않은 경우라면 생성까지 같이 처리한다.
    // 이때 기존에 생성되어져 있는 thread와 새로 생성된 thread(처음 comment를 추가하려는 thread)를 구분할 수 있어야 한다.
    let isNewThread = false
    const source = reply.thread.uri.fsPath
    const prismName = path.parse(source).name
    const threads = this.commentThreads.get(prismName)
    if (!threads) {
      console.warn(`No comment thread: ${prismName}`)
    } else {
      if (!threads.find(thread => thread === reply.thread)) {
        console.log('new thread: thread label is', reply.thread.label)
        threads.push(reply.thread)
        isNewThread = true
      }
    }

    const note = Prism.getDefaultNote(reply.text)
    const newComment = new NoteDescription(
      note,
      new vscode.MarkdownString(convertLink(reply.text)),
      vscode.CommentMode.Preview,
      reply.thread
    )

    reply.thread.comments = [...reply.thread.comments, newComment]

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
      issue = prism.appendIssueDetails(title, source, reply.thread.range)
    }

    if (isNewThread) {
      reply.thread.label = title
      reply.thread.contextValue = issue.id
    }

    prism.appendNote(issue.id, { ...note, content: this.extractLinkFromNoteContent(note.content) })
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
      console.error('error in cancelAddNote: No thread')
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
   * Deletes a issue comment from its thread. If the thread becomes empty after the deletion,
   * the thread is disposed of.
   *
   * @param desc - The issue comment to be deleted.
   */
  deleteNote(desc: NoteDescription) {
    const thread = desc.thread
    if (!thread) {
      console.error('error in deleteNote: No thread')
      return
    }

    thread.comments = thread.comments.filter(cmt => (cmt as NoteDescription).id !== desc.id)

    // desc.thread와 desc.id를 이용해서 note를 찾은 다음 call back을 호출해서 note를 삭제한다.
    this.doItForNodeFromThread(thread, desc.id, (prism: Prism, issue: Issue, note: Note) => {
      prism.removeNote(issue.id, note.id)

      issue.notes = issue.notes.filter(n => n.id !== desc.id)
      if (issue.notes === undefined || issue.notes.length === 0) {
        prism.removeIssue(issue.id)
      }

      PrismManager.updatePrism(prism)
    })

    if (thread.comments.length === 0) {
      thread.dispose()
    }
  }

  /**
   * Changes the category of a note in a thread.
   *
   * @param desc - The description of the note, which includes the thread and author information.
   * @returns A promise that resolves when the category has been changed or if the operation is cancelled.
   *
   * This function prompts the user to enter a new category for the note. If the user provides a valid category,
   * it updates the author of the note with the new category. If the user cancels the input or provides an empty
   * category, the function returns without making any changes.
   */
  async changeNoteCategory(desc: NoteDescription) {
    const thread = desc.thread
    if (!thread) {
      console.error('error in changeNoteCategory: No thread')
      return
    }

    const category = await vscode.window.showInputBox({
      placeHolder: 'Enter new category: e.g., "todo", "fix", "refactor", "enhancement"',
      prompt: `Change the category: `,
      value: desc.author.name,
    })
    if (category === undefined || category === '') {
      return
    }

    // comments에 있는 comment만 변경해서는 반영이 되지 않는다. comments를 새로 생성해야 한다.
    thread.comments = thread.comments.map(c => {
      const cmt = c as NoteDescription
      if (cmt.id === desc.id) {
        cmt.author = createAuthor(category)
      }
      return cmt
    })

    // desc.thread와 desc.id를 이용해서 note를 찾은 다음 call back을 호출해서 category를 변경한다.
    this.doItForNodeFromThread(thread, desc.id, (prism: Prism, issue: Issue, note: Note) => {
      note.category = category
      prism.updateNote(issue.id, note)
      PrismManager.updatePrism(prism)
    })
  }

  /**
   * Generates a markdown file for a given note description.
   *
   * @param desc - The description of the note for which the markdown file is to be created.
   *
   * This function performs the following steps:
   * 1. Finds the prism issue note by the note ID from the provided description.
   * 2. If the note is found, it attempts to create a markdown file for the note.
   * 3. If the markdown file is newly created, it updates the note's link in the corresponding prism issue.
   * 4. Updates the prism with the new note link.
   */
  makeMarkdown(desc: NoteDescription) {
    const thread = desc.thread
    if (!thread) {
      console.error('error in makeMarkdown: No thread')
      return
    }

    const result = PrismManager.findPrismIssueNoteByNoteId(desc.id)
    if (!result) {
      return
    }

    const exist = !PrismFileManager.createMarkdownFile(result.note.id, result.prism, result.issue)
    if (exist) {
      return
    }

    const link = 'file:///./docs/' + desc.id + '.md'

    // 파일이 새로 생성되었을 경우에는 body에 link를 추가하고 note의 link를 업데이트한다.
    // saveNote의 과정과 거의 동일하다. 단지 note의 link를 업데이트하는 것만 추가되었다.
    // comments에 있는 comment만 변경해서는 반영이 되지 않는다. comments를 새로 생성해야 한다.
    let found: vscode.Comment | undefined
    thread.comments = thread.comments.map(c => {
      const cmt = c as NoteDescription
      if (cmt.id === result.note.id) {
        const contents = this.appendLinkToNoteContent(result.note.content, link)
        const body = new vscode.MarkdownString(convertLink(contents))

        cmt.body = body
        cmt.savedBody = cmt.body
        cmt.mode = vscode.CommentMode.Preview
        found = cmt
      }
      return cmt
    })

    // desc.thread와 desc.id를 이용해서 note를 찾은 다음 call back을 호출해서 note를 삭제한다.
    this.doItForNodeFromThread(thread, result.note.id, (prism: Prism, issue: Issue, note: Note) => {
      if (found) {
        note.content = typeof found.body === 'string' ? found.body : found.body.value
      }

      // note의 link와 content를 업데이트한다.
      prism.updateNote(issue.id, { ...note, link, content: this.extractLinkFromNoteContent(note.content) })
      PrismManager.updatePrism(prism)
    })
  }

  /**
   * Edits the description of a issue by setting the mode of the corresponding comment to editing.
   *
   * @param desc - The note description object containing the thread and comments.
   */
  editNote(desc: NoteDescription) {
    const thread = desc.thread
    if (!thread) {
      console.error('error in editNote: No thread')
      return
    }

    thread.comments = thread.comments.map(cmt => {
      if ((cmt as NoteDescription).id === desc.id) {
        cmt.mode = vscode.CommentMode.Editing
      }

      return cmt
    })
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
      console.error('error in saveNote: No thread')
      return
    }

    const result = PrismManager.findPrismIssueNoteByNoteId(desc.id)
    if (!result) {
      return
    }

    // comments에 있는 comment만 변경해서는 반영이 되지 않는다. comments를 새로 생성해야 한다.
    let found: vscode.Comment | undefined
    thread.comments = thread.comments.map(c => {
      const cmt = c as NoteDescription
      if (cmt.id === desc.id) {
        const descBody = typeof desc.body === 'string' ? desc.body : desc.body.value
        const contents = this.appendLinkToNoteContent(descBody, result.note.link)
        const body = new vscode.MarkdownString(convertLink(contents))

        cmt.body = body
        cmt.savedBody = cmt.body
        cmt.mode = vscode.CommentMode.Preview
        found = cmt
      }
      return cmt
    })

    // desc.thread와 desc.id를 이용해서 note를 찾은 다음 call back을 호출해서 note를 삭제한다.
    this.doItForNodeFromThread(thread, desc.id, (prism: Prism, issue: Issue, note: Note) => {
      if (found) {
        note.content = typeof found.body === 'string' ? found.body : found.body.value
      }

      prism.updateNote(issue.id, { ...note, content: this.extractLinkFromNoteContent(note.content) })
      PrismManager.updatePrism(prism)
    })
  }

  /**
   * Cancels the save operation for a issue comment by restoring its original body and setting its mode to preview.
   *
   * @param desc - The issue comment to cancel the save operation for.
   */
  cancelSaveNote(desc: NoteDescription) {
    const thread = desc.thread
    if (!thread) {
      console.error('error in cancelSaveNote: No thread')
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
   * Executes a callback function for a specific note within a comment thread.
   *
   * @param thread - The comment thread containing the note.
   * @param noteId - The unique identifier of the note.
   * @param callback - The function to execute, which receives the prism, issue, and note as arguments.
   *
   * @remarks
   * This method retrieves the prism and issue associated with the given comment thread and note ID.
   * If the prism or issue cannot be found, or if the note does not exist, a warning is logged and the callback is not executed.
   *
   * @throws Will log a warning if the prism, issue, or note cannot be found.
   */
  private doItForNodeFromThread(
    thread: vscode.CommentThread,
    noteId: string,
    callback: (prism: Prism, issue: Issue, note: Note) => void
  ): void {
    const prismName = path.parse(thread.uri.fsPath).name
    const prism = PrismManager.getPrism(prismName)
    if (!prism) {
      console.error('error in getNodeFromThread: No prism, name: ' + prismName)
      return
    }

    const issue = prism.getIssue(thread.contextValue!)
    if (!issue) {
      const issueTitle = thread.label?.trim() ?? ''
      console.error('error in getNodeFromThread: No issue, title: ' + issueTitle)
      console.log('  thread.contextValue:', thread.contextValue)
      return
    }

    const note = issue.notes.find(n => n.id === noteId)
    if (!note) {
      console.error('error in deleteNote: No note, noteId: ' + noteId)
      return
    }

    callback(prism, issue, note)
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
  private createNoteDescription(note: Note): NoteDescription {
    // note를 comment로 변환한다.
    // 이때 comment에는 표시되지 않는 issue의 정보(예를들면 link)를 comment.body에 추가한다.
    // 또 note의 body에 있는 링크 정보를 절대 경로로 변환해 준다.(comment에서는 상대 경로를 지원하지 않음)
    const contents = this.appendLinkToNoteContent(note.content, note.link)
    const body = new vscode.MarkdownString(convertLink(contents))
    return new NoteDescription(note, body, vscode.CommentMode.Preview)
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
  private appendLinkToNoteContent(noteContent: string, noteLink: string | undefined): string {
    // comment controlller에서는 note의 링크가 표시되어지지 않기 때문에 이를 body에 추가해서 표시한다.
    // 또한 note.content에서 지정한 문서들의 링크도 표시 문제로 절대 경로로 변경해서 저장해야 한다.
    const result: string[] = []

    // 필요없다고 생각하지만 note.content에 이미 변환된 내용이 있는지 확인하고 있으면 제거한다.
    result.push(this.extractLinkFromNoteContent(noteContent))

    // comment controller의 입력창에서 설정하는 링크는 이것이 비록 마크다운 형태로 처리되어도 `file:///절대경로` 만 인식한다.
    if (noteLink) {
      let root = PrismFileManager.getWorkspacePath() ?? ''
      let link = noteLink.replace('file:///', '')
      if (link.startsWith('./')) {
        // prism folder에서의 상대 경로인 경우에는...
        // 이 링크가 prism file에 저장되어져 있기 때문에 여기서 현재 폴더는 prism folder이다.
        root = PrismFileManager.getPrismFolderPath()
      }

      // string으로 저장할시에는 \를 /로 변경해야 한다. 그렇지 않으면 . 으로 시작하는 폴더가 상위 폴더와 분리가 되지 않는다.
      link = path.join(root, link).replaceAll('\\', '/')

      result.push('\n---')
      result.push('_Modifing this section is useless!_')
      result.push(`- [linked document - ${noteLink}](file:///${link})`)
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
  private extractLinkFromNoteContent(noteContent: string) {
    // note.content에 이미 변환된 내용이 있는지 확인하고 있으면 제거한다.
    // 이 기능은 note를 저장할 때만 사용된다.
    let original = noteContent
    const index = noteContent.indexOf('\n---\n_Modifing this section is useless!_\n- [linked document -')
    if (index > 0) {
      original = noteContent.slice(0, index).trim()
    }
    return original
  }
}
