import crypto from 'crypto'

import { PubSub, SubscribeType } from './PrismManager'

/**
 * Generates a universally unique identifier (UUID).
 *
 * This function uses the `crypto` module to generate a random 16-byte value
 * and returns it as a hexadecimal string.
 *
 * @returns {string} A randomly generated UUID in hexadecimal format.
 */
export function uuid(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Prism은 파일 하나당 하나씩 존재하며, 여러 개의 Issue를 가질 수 있다.
 * Issue는 파일 내의 특정 위치와 연결되어지며 해당 위치에 대한 다수의 정보(Note)를 담고 있다.
 * Note은 단일 정보를 의미하며 텍스트와 Link등으로 하나의 정보를 표현한다.
 *
 * @remarks
 * Prism 개체는 `new Prism()`으로 생성하면 안된다. `PrismManager.createPrism()`을 사용해야 한다.
 *
 * @class
 * @property {string} ver - The version of the Prism.
 * @property {string} name - The name of the Prism.
 * @property {Issue[]} issues - The collection of issues.
 */
export class Prism {
  // Prism, Issue, Note에 변경 사항을 발생하면 PubSub을 이용하여 subscriber에게 변경 사항을 전달한다
  // publish-subscribe의 설정은 PrismManager를 통해서 설정하며 Prism 개체는 단지 PrismManager의
  // 설정값을 사용할 뿐이다. Prism의 pubSub 설정도 PrismManager가 Prism 생성 후 설정해 준다.
  private pubSub?: PubSub<SubscribeType>
  setPubSub(pubSub: PubSub<SubscribeType>): void {
    this.pubSub = pubSub
  }

  ver: string = '1.0.0'
  name: string = ''
  issues: Issue[] = []

  /**
   * Constructs a new instance of the Prism class.
   *
   * @param json - An optional parameter that can be used to initialize the instance properties.
   * @param json.ver - The version of the prism.
   * @param json.name - The name of the prism.
   * @param json.issues - Additional issues about the prism.
   */
  constructor(json?: any) {
    if (json) {
      this.ver = json.ver
      this.name = json.name
      this.issues = json.issues
    }
  }

  /**
   * Converts the current object to a JSON representation.
   *
   * @returns {any} A JSON object containing the version, name, and issues of the current object.
   */
  toJson(): any {
    return {
      ver: this.ver,
      name: this.name,
      issues: this.issues,
    }
  }

  /**
   * Converts the current object to a JSON string representation.
   *
   * @returns {string} A stringified JSON representation of the object.
   */
  toString(): string {
    const json = {
      '#': 'NOT recommend to edit manually. Write carefully! This file is generated by code-prism vscode extension.',
      ver: this.ver,
      name: this.name,
      issues: this.issues,
    }
    return JSON.stringify(json, null, 2)
  }

  /**
   * Clears the issues array by setting it to an empty array.
   *
   * @remarks
   * This method is used to reset the issues stored in the instance.
   */
  clear(): void {
    this.issues = []
  }

  /**
   * Checks if the issues array is empty.
   *
   * @returns {boolean} `true` if the issues array is empty, otherwise `false`.
   */
  isEmpty(): boolean {
    return this.issues.length === 0
  }

  /**
   * Retrieves the count of issues.
   *
   * @returns {number} The number of issues.
   */
  getIssuesCount(): number {
    return this.issues.length
  }

  /**
   * Retrieves the list of issues.
   *
   * @returns {Issue[]} An array of Issue objects.
   */
  getIssues(): Issue[] {
    return this.issues
  }

  /**
   * Retrieves a issue by its unique identifier.
   *
   * @param id - The unique identifier of the issue to retrieve.
   * @returns The issue with the specified identifier, or `undefined` if no such issue exists.
   */
  getIssue(id: string): Issue | undefined {
    return this.issues.find(i => i.id === id)
  }

  /**
   * Retrieves a issue by its title.
   *
   * @param title - The title of the issue to retrieve.
   * @returns The issue with the specified title, or `undefined` if no such issue exists.
   */
  getIssueByTitle(title: string): Issue | undefined {
    return this.issues.find(i => i.title === title)
  }

  /**
   * Appends an issue to the list of issues if it does not already exist.
   * If the issue already exists, it returns the existing issue.
   *
   * @param issue - The issue to be appended.
   * @returns The appended issue or the existing issue if it already exists.
   */
  appendIssue(issue: Issue): Issue {
    const exist = this.getIssue(issue.id)
    if (exist) {
      return exist
    }

    this.issues.push(issue)
    this.pubSub?.publish('append-issue', { prism: this, issue })
    return issue
  }

  /**
   * Updates an existing issue by first removing the issue with the same title
   * and then adding the new issue.
   *
   * @param issue - The issue object to be updated.
   */
  updateIssue(issue: Issue): void {
    this.removeIssue(issue.id)
    this.appendIssue(issue)
  }

  /**
   * Removes a issue from the list of issues based on the provided title.
   *
   * @param issueId - The title of the issue to be removed.
   */
  removeIssue(issueId: string): void {
    const remove = this.getIssue(issueId)
    if (!remove) {
      return
    }

    this.issues = this.issues.filter(i => i.id !== issueId)
    this.pubSub?.publish('remove-issue', { prism: this, issue: remove })
  }

  /**
   * Appends a note to the specified issue.
   *
   * @param issueId - The ID of the issue to which the note will be appended.
   * @param note - The note to append to the issue.
   * @returns The appended note if the issue exists, otherwise `undefined`.
   */
  appendNote(issueId: string, note: Note): Note | undefined {
    const issue = this.getIssue(issueId)
    if (!issue) {
      return undefined
    }

    issue.notes.push(note)
    this.pubSub?.publish('append-note', { prism: this, issue, note })
    // console.log(`🚀 ~ appendNote: ${issueId}, ${note.id}`)
    return note
  }

  /**
   * Updates the description of a issue with the given issueId.
   * If the issue or the description is not found, the method returns without making any changes.
   *
   * @param issueId - The unique identifier of the issue to update.
   * @param note - The new note to update in the issue.
   *
   * @remarks
   * This method publishes an 'update-note' event with the updated description if the update is successful.
   */
  updateNote(issueId: string, note: Note): void {
    const issue = this.getIssue(issueId)
    if (!issue) {
      return
    }

    const exist = issue.notes.find(n => n.id === note.id)
    if (!exist) {
      return
    }

    Object.assign(exist, note)
    this.pubSub?.publish('update-note', { prism: this, issue, note })
    // console.log(`🚀 ~ updateNote: ${issueId}, ${note.id}`)
  }

  /**
   * Removes a description from a issue by its ID.
   *
   * @param issueId - The ID of the issue from which the description will be removed.
   * @param noteId - The ID of the description to be removed.
   * @returns void
   */
  removeNote(issueId: string, noteId: string): void {
    const issue = this.getIssue(issueId)
    if (!issue) {
      return
    }

    let note = issue.notes.find(n => n.id === noteId)
    if (!note) {
      return
    }

    // note의 경우에는 삭제 후 issue.notes가 비어있으면 해당 issue도 삭제한다.
    issue.notes = issue?.notes.filter(n => n.id !== noteId)
    if (issue.notes.length === 0) {
      this.removeIssue(issueId)
    } else {
      this.pubSub?.publish('remove-note', { prism: this, issue, note })
      // console.log(`🚀 ~ removeNote: ${issueId}, ${note.id}`)
    }
  }

  /**
   * Generates a default note object.
   *
   * @param content - An optional string to include in the note.
   * @returns A `Note` object with default values.
   */
  static getDefaultNote(content?: string): Note {
    return {
      id: uuid(),
      category: 'Todo',
      importance: 'Medium',
      createdAt: new Date().toISOString(),
      content: content ?? 'I have something to do',
    }
  }
}

/**
 * Represents a issue with an identifier, title, source, and notes.
 *
 * @interface Issue
 * @property {string} id - The unique identifier for the issue.
 * @property {string} title - The title of the issue.
 * @property {Source} source - The source information of the issue.
 * @property {Note[]} notes - An array of notes associated with the issue.
 */
export interface Issue {
  id: string
  title: string
  source: Source
  notes: Note[]
}

/**
 * Represents a source code location with optional links.
 *
 * @interface Source
 *
 * @property {string} file - The file path of the source code.
 * @property {number} startLine - The starting line number of the source code.
 * @property {number} startColumn - The starting column number of the source code.
 * @property {number} endLine - The ending line number of the source code.
 * @property {number} endColumn - The ending column number of the source code.
 * @property {string} [link] - An optional link associated with the source code.
 * @property {string} [link2] - An optional second link associated with the source code.
 */
export interface Source {
  file: string
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
  link?: string
  link2?: string
}

/**
 * Represents a note of a code entity.
 *
 * @interface Note
 *
 * @property {string} id - The unique identifier for the note.
 * @property {string} category - The category to which the note belongs.
 * @property {string} importance - The importance level of the note.
 * @property {string} createdAt - The date and time when the note was created.
 * @property {string} content - The content of the note.
 * @property {string} [link] - An optional link related to the note.
 * @property {string} [link2] - An optional second link related to the note.
 */
export interface Note {
  id: string
  category: string
  importance: string
  createdAt: string
  content: string
  link?: string
  link2?: string
}
