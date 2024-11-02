import * as vscode from 'vscode'
import * as fs from 'fs'

import { Note, Issue, Prism } from './Prism'
import { PrismFileManager } from './PrismFileManager'

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
 * @property {Note} [desc] - Optional note object associated with the subscription.
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
 * const newPrism = PrismManager.createPrism('MyPrism');
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
   * Creates a new Prism instance with the specified name and sets up its PubSub system.
   *
   * @param name - The name to assign to the new Prism instance.
   * @returns A new Prism instance with the specified name and PubSub system configured.
   */
  static createPrism(name: string) {
    const prism = new Prism()
    prism.name = name
    prism.setPubSub(this.pubSub)
    return prism
  }

  /**
   * Creates an instance of `Prism` from a JSON object.
   *
   * @param json - The JSON object to convert into a `Prism` instance.
   * @returns A new `Prism` instance.
   */
  static createPrismFromJson(json: any): Prism {
    const prism = new Prism(json)
    prism.setPubSub(this.pubSub)
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
    const text = fs.readFileSync(file, 'utf-8')

    // 텍스트를 JSON 객체로 파싱
    const json = JSON.parse(text)

    // JSON 객체를 사용하여 Prism 객체 생성 및 반환
    return this.createPrismFromJson(json)
  }

  /**
   * Retrieves a prism by its name. If the prism does not exist and `forceCreate` is true,
   * a new prism will be created.
   *
   * @param name - The name of the prism to retrieve.
   * @param forceCreate - If true, a new prism will be created if one with the given name does not exist.
   * @returns The prism with the specified name, or undefined if it does not exist and `forceCreate` is false.
   */
  static getPrism(name: string, forceCreate: boolean = false): Prism | undefined {
    const prism = this.prisms.find(p => p.name === name)
    if (!prism && forceCreate) {
      return this.createPrismAndFile(name)
    }
    return prism
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
   * Loads all Prism files from the designated Prism folder.
   *
   * This method checks if the Prism folder exists, and if it does, reads all files
   * within the folder. Each file is processed and converted into a Prism object
   * which is then added to the `prisms` array.
   *
   * @returns {Prism[]} An array of loaded Prism objects.
   */
  static async loadPrismFiles(): Promise<Prism[]> {
    // if (this.isPrismFolderExists()) {
    //   const prismFolderPath = this.getPrismFolderPath()
    //   const files = fs.readdirSync(prismFolderPath)
    //   const pa: Prism[] = []
    //   files.forEach(file => {
    //     const filePath = path.resolve(prismFolderPath, file)
    //     const stats = fs.statSync(filePath)
    //     if (stats.isFile()) {
    //       const prism = PrismReader.read(filePath)
    //       pa.push(prism)
    //     }
    //   })
    //   this.prisms = pa
    // }

    if (!PrismFileManager.isPrismFolderExists()) {
      return []
    }

    let folderName = PrismFileManager.getPrismFolderName()
    let files = await vscode.workspace.findFiles(`**/${folderName}/*.prism.json`, null, 500)

    this.prisms = []
    files.forEach(file => {
      this.prisms.push(this.createPrismFromFile(file.fsPath))
    })
    return this.prisms
  }

  /**
   * Creates a new Prism file with the given name.
   *
   * This method performs the following steps:
   * 1. Retrieves the path to the Prism folder.
   * 2. Creates the Prism folder if it does not exist.
   * 3. Instantiates a new Prism object and assigns the provided name to it.
   * 4. Saves the Prism file.
   * 5. Creates a 'docs' folder inside the Prism folder if it does not exist.
   * 6. Creates a markdown file for the Prism documentation inside the 'docs' folder.
   * 7. Adds the new Prism object to the list of prisms.
   *
   * @param name - The name of the Prism file to be created.
   * @returns The created Prism object.
   */
  static createPrismAndFile(name: string): Prism {
    const prism = this.createPrism(name)

    PrismFileManager.createPrismFile(prism)

    this.prisms.push(prism)
    this.publish('create-prism', { prism })
    return prism
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
    const found = this.prisms.find(p => p.name === prism.name)
    if (found) {
      PrismFileManager.savePrismFile(prism)
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
    await PrismFileManager.deletePrismFile(prism.name)

    const deletingPrism = this.prisms.find(p => p.name === prism.name)
    if (deletingPrism) {
      this.publish('delete-prism', { prism: deletingPrism })
      this.prisms = this.prisms.filter(p => p.name !== prism.name)
    }
  }

  /**
   * Finds and returns all issues that match the given source file.
   *
   * @param source - The source file to search for in the issues.
   * @returns An array of issues that have the specified source file.
   */
  static findIssuesBySource(source: string): Issue[] {
    let issues: Issue[] = []
    for (const prism of this.prisms) {
      issues = issues.concat(prism.issues.filter(i => i.source.file === source))
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
        const note = issue.notes.find(n => n.id === noteId)
        if (note) {
          return { prism, issue, note }
        }
      }
    }
    console.error('error in findPrismIssueNoteByNoteId: noteId is', noteId)
    return undefined
  }
}
