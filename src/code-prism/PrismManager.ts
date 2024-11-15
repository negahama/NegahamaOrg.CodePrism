import * as vscode from 'vscode'
import * as assert from 'assert'

import { Note, Issue, Prism } from './Prism'
import { PrismPath } from './PrismPath'
import { PrismFileSystem } from './PrismFileSystem'

export type Callback<T> = (data: T) => void

/**
 * A simple publish-subscribe (PubSub) class that allows subscribing to events,
 * unsubscribing from events, and publishing events to subscribers.
 *
 * @template T - The type of data that will be passed to subscribers.
 */
export class PubSub<T> {
  /**
   * An object that holds the subscribers for each event.
   * The keys are event names and the values are arrays of callbacks.
   *
   * @private
   * @type {{ [event: string]: Callback<T>[] }}
   */
  private subscribers: { [event: string]: Callback<T>[] } = {}

  /**
   * Subscribes a callback function to a specific event.
   *
   * @param {string} event - The name of the event to subscribe to.
   * @param {Callback<T>} callback - The callback function to be called when the event is published.
   */
  subscribe(event: string, callback: Callback<T>): void {
    if (!this.subscribers[event]) {
      this.subscribers[event] = []
    }
    this.subscribers[event].push(callback)
  }

  /**
   * Unsubscribes a callback function from a specific event.
   *
   * @param {string} event - The name of the event to unsubscribe from.
   * @param {Callback<T>} callback - The callback function to be removed from the subscribers list.
   */
  unsubscribe(event: string, callback: Callback<T>): void {
    if (!this.subscribers[event]) {
      return
    }
    this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback)
  }

  /**
   * Publishes an event, calling all subscribed callback functions with the provided data.
   *
   * @param {string} event - The name of the event to publish.
   * @param {T} data - The data to be passed to the callback functions.
   */
  publish(event: string, data: T): void {
    if (!this.subscribers[event]) {
      return
    }
    this.subscribers[event].forEach(callback => callback(data))
  }
}

/**
 * Represents the type for subscription details.
 *
 * @interface SubscribeType
 *
 * @property {Prism} [prism] - Optional prism object associated with the subscription.
 * @property {Issue} [issue] - Optional issue object associated with the subscription.
 * @property {Note} [note] - Optional note object associated with the subscription.
 */
export interface SubscribeType {
  prism?: Prism
  issue?: Issue
  note?: Note
}

/**
 * The `PrismManager` class is responsible for managing `Prism` objects within the application.
 * It provides methods for creating, loading, saving, and manipulating `Prism` instances,
 * as well as handling events related to these objects through a publish-subscribe mechanism.
 *
 * @remarks
 * This class uses the `PubSub` class to manage events and the Visual Studio Code API for workspace interactions.
 * It also handles file operations for reading and writing `Prism` objects to and from the file system.
 *
 * @example
 * ```typescript
 * // Subscribe to an event
 * PrismManager.subscribe('create-prism', (data) => {
 *   console.log('Prism created:', data.prism);
 * });
 *
 * // Create a new Prism
 * const newPrism = PrismManager.createPrismAndFile('MyPrism');
 *
 * // Load all Prism files from the designated folder
 * const prisms = await PrismManager.loadPrismFiles();
 * ```
 */
export class PrismManager {
  /**
   * A static instance of the PubSub class that handles publishing and subscribing to events
   * related to `Prism`, `Issue`, or `Note` objects.
   *
   * @private
   * @type {PubSub<SubscribeType>}
   */
  private static pubSub: PubSub<SubscribeType> = new PubSub<SubscribeType>()

  static subscribe(event: string, callback: Callback<SubscribeType>): void {
    this.pubSub.subscribe(event, callback)
  }

  static unsubscribe(event: string, callback: Callback<SubscribeType>): void {
    this.pubSub.unsubscribe(event, callback)
  }

  static publish(event: string, data: SubscribeType): void {
    this.pubSub.publish(event, data)
  }

  /**
   * A static array that holds instances of the `Prism` class.
   * This array is used to manage and store all the prism objects
   * created within the application.
   */
  private static prisms: Prism[] = []

  /**
   * Retrieves a Prism instance by its name.
   *
   * @param name - The name of the Prism to retrieve.
   * @returns The Prism instance with the specified name, or undefined if not found.
   */
  static getPrism(name: string): Prism | undefined {
    return this.prisms.find(p => p.name === name)
  }

  /**
   * Retrieves all the prisms.
   *
   * @returns {Prism[]} An array of all prisms.
   */
  static getAllPrisms(): Prism[] {
    return this.prisms
  }

  /**
   * Creates a new prism with the given name, saves it to the file system,
   * adds it to the list of prisms, and publishes a 'create-prism' event.
   * Prism 객체 자체만 생성하는 것이라서 issue에 대한 별도의 처리는 필요하지 않다.
   *
   * @param name - The name of the prism to create.
   * @returns The created prism.
   */
  static createPrismAndFile(name: string): Prism {
    let prism = this.getPrism(name)
    if (prism) {
      vscode.window.showWarningMessage('The prism already exists.')
      return prism
    }

    prism = new Prism()
    prism.name = name
    prism.setPubSub(this.pubSub)

    PrismFileSystem.createPrismFile(prism)

    this.prisms.push(prism)
    this.publish('create-prism', { prism })
    return prism
  }

  /**
   * 주어진 파일 경로에서 JSON 파일을 읽고 Prism 객체로 변환
   *
   * @param file - The path to the file to read and convert to a Prism object.
   * @returns A Prism object created from the JSON content of the file.
   */
  static createPrismFromFile(file: string): Prism {
    // 파일을 읽어 텍스트로 변환
    const text = PrismFileSystem.readFile(file)

    // 텍스트를 JSON 객체로 파싱
    const json = JSON.parse(text)

    let prism = this.getPrism(json.name)
    if (prism) {
      vscode.window.showWarningMessage('The prism already exists.')
      return prism
    }

    // JSON 객체를 사용하여 Prism 객체 생성 및 반환
    // 이때, Issue 객체의 prism property를 설정해 주어야 한다.
    prism = new Prism(json)
    prism.issues.forEach(issue => (issue.prism = prism))
    prism.setPubSub(this.pubSub)

    this.prisms.push(prism)
    this.publish('create-prism', { prism })
    return prism
  }

  /**
   * Loads all Prism files from the designated Prism folder.
   *
   * This method checks if the Prism folder exists, and if it does, reads all files
   * within the folder. Each file is processed and converted into a Prism object
   * which is then added to the `prisms` array.
   *
   * @returns {Prism[]} An array of loaded Prism objects.
   */
  static async loadPrismFiles(): Promise<Prism[]> {
    this.prisms = []
    const files = await PrismFileSystem.getPrismFileNames()
    files.forEach(file => {
      this.createPrismFromFile(file)
    })
    return this.prisms
  }

  /**
   * Updates the prism associated with a given file path.
   * update는 이미 있는지 여부만 검사하고 내용이 동일한지는 검사하지 않는다.
   * 이미 있는 경우에는 무조건 업데이트하고 없으면 아무 처리도 하지 않는다.
   *
   * @param prism - The new prism object to associate with the file.
   * @returns `true` if the file was found and updated, otherwise `false`.
   */
  static updatePrism(prism: Prism): boolean {
    const found = this.getPrism(prism.name)
    if (found) {
      PrismFileSystem.savePrismFile(prism)
      return true
    }
    return false
  }

  /**
   * Deletes a Prism file from the workspace.
   *
   * This method removes the specified file from the workspace using a `vscode.WorkspaceEdit`.
   * It does not perform any additional checks or operations on the file system.
   *
   * @param name - The name of the file to be deleted.
   * @returns A promise that resolves when the file has been deleted.
   */
  static async deletePrism(prism: Prism): Promise<void> {
    if (!PrismFileSystem.isPrismFileExists(prism.name)) {
      vscode.window.showWarningMessage('The prism does not exist.')
    } else {
      await PrismFileSystem.deletePrismFile(prism.name)
    }

    const deletingPrism = this.getPrism(prism.name)
    if (deletingPrism) {
      this.publish('delete-prism', { prism: deletingPrism })
      this.prisms = this.prisms.filter(p => p.name !== prism.name)
    }
  }

  /**
   * Retrieves an issue by its ID from the list of prisms.
   *
   * @param issueId - The unique identifier of the issue to be retrieved.
   * @returns The issue with the specified ID, or `undefined` if not found.
   */
  static getIssue(issueId: string): Issue | undefined {
    for (const prism of this.prisms) {
      const issue = prism.getIssue(issueId)
      if (issue) {
        return issue
      }
    }
    return undefined
  }

  /**
   * Updates the given issue by saving its associated prism file.
   *
   * [[al=ec2692f9b51bc6db7d6894c28ad81d34]]
   *
   * @param issue - The issue object that contains the prism property.
   * @throws Will throw an error if the issue does not have a prism property.
   */
  static updateIssue(issue: Issue) {
    assert.ok(issue.prism, 'updateIssue: issue does not have a prism property')
    PrismFileSystem.savePrismFile(issue.prism)
  }

  /**
   * Deletes an issue with the specified ID from all prisms.
   * If the issue is found in a prism, it is removed and the prism file is saved.
   *
   * @param issueId - The ID of the issue to be deleted.
   */
  static deleteIssue(issueId: string | Issue): void {
    let issue: Issue | undefined
    if (typeof issueId == 'string') {
      issue = this.getIssue(issueId)
    } else {
      issue = issueId
    }

    if (issue) {
      assert.ok(issue.prism, 'deleteIssue: issue does not have a prism property')
      issue.prism.removeIssue(issue.id)
      PrismFileSystem.savePrismFile(issue.prism)
    }
  }

  /**
   * Iterates over all issues in all prisms and applies the provided callback function to each issue.
   * If the callback function returns `true` for any issue, the iteration stops.
   *
   * @param callback - A function that takes an `Issue` object as an argument and returns a boolean.
   *                   If the function returns `true`, the iteration stops.
   */
  static travelIssues(callback: (issue: Issue) => boolean) {
    for (const prism of this.prisms) {
      for (const issue of prism.issues) {
        if (callback(issue)) {
          return
        }
      }
    }
  }

  /**
   * Finds and returns all issues that match the given source file.
   *
   * @param source - The source file to search for in the issues.
   * @returns An array of issues that have the specified source file.
   */
  static findIssuesBySource(source: string): Issue[] {
    const path = '/' + PrismPath.getRelativePath(source).replace(/\\/g, '/')
    let issues: Issue[] = []
    for (const prism of this.prisms) {
      issues = issues.concat(prism.issues.filter(i => i.source.file === path))
    }
    return issues
  }

  /**
   * Retrieves a issue and its corresponding note by the note ID.
   *
   * @param noteId - The ID of the note to find.
   * @returns An object containing the issue and note if found, otherwise `undefined`.
   */
  static findPrismIssueNoteByNoteId(noteId: string): { prism: Prism; issue: Issue; note: Note } | undefined {
    for (const prism of this.prisms) {
      for (const issue of prism.issues) {
        const note = issue.findNote(noteId)
        if (note) {
          return { prism, issue, note }
        }
      }
    }
    console.error('error in findPrismIssueNoteByNoteId: noteId is', noteId)
    return undefined
  }

  /**
   * Retrieves the title and range of the selected text in the given editor.
   *
   * If the selection is empty, it will get the word at the cursor position or the entire line if no word is found.
   * If the selection spans multiple lines, it assumes the top line contains the function name.
   *
   * @param editor - The text editor from which to retrieve the title and range.
   * @returns An object containing the title (text) and the range of the selected text.
   */
  static getCodeWithRangeAndPath(editor: vscode.TextEditor): { code: string; range: vscode.Range; path: string } {
    let range: vscode.Range | undefined
    if (editor.selection.isEmpty) {
      const position = editor.selection.active
      range = editor.document.getWordRangeAtPosition(position)
      if (!range) {
        const line = editor.selection.active.line
        range = editor.document.lineAt(line).range
      }
    } else {
      range = editor.selection
    }

    const code = editor.document.getText(range)
    const path = PrismPath.getRelativePath(editor.document.uri.fsPath)

    return { code, range, path }
  }
}
