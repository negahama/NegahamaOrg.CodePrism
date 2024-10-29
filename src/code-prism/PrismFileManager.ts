import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

import { Issue, Prism } from './Prism'

export const PRISM_FOLDER_NAME = '.prism'
export const PRISM_DOCS_FOLDER_NAME = 'docs'
export const PRISM_FILE_EXT = 'prism.json'

/**
 * The `PrismFileManager` class provides methods to manage Prism files within a Visual Studio Code workspace.
 * It includes functionalities to retrieve workspace paths, check for the existence of folders and files,
 * create new files and folders, and perform file operations such as renaming and deleting.
 *
 * @remarks
 * This class relies on the Visual Studio Code API and Node.js file system operations to manage files and directories.
 * It is designed to work within the context of a Visual Studio Code extension.
 */
export class PrismFileManager {
  /**
   * Retrieves the root path of the current workspace.
   *
   * @returns {string | undefined} The root path of the workspace if available, otherwise `undefined`.
   *
   * @remarks
   * If no workspace is open, an error message is logged to the console.
   */
  static getWorkspacePath(): string | undefined {
    // const document = vscode.window.activeTextEditor?.document
    // if (document) {
    //   return vscode.workspace.getWorkspaceFolder(document.uri)?.uri?.fsPath ?? ''
    // }

    // 작업 영역의 루트 경로 가져오기
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath
    } else {
      console.error('작업 영역이 열려 있지 않습니다.')
    }
  }

  /**
   * Retrieves the name of the Prism folder from the workspace configuration.
   * If the configuration is not set, it returns the default Prism folder name.
   *
   * @returns {string} The name of the Prism folder.
   */
  static getPrismFolderName(): string {
    const settings = vscode.workspace.getConfiguration('CodePrism')
    return settings.get<string>('config.PrismFolder') ?? PRISM_FOLDER_NAME
  }

  /**
   * Retrieves the full path to the Prism folder within the workspace.
   *
   * @returns {string} The full path to the Prism folder.
   */
  static getPrismFolderPath(): string {
    return path.join(this.getWorkspacePath() ?? '', this.getPrismFolderName())
  }

  /**
   * Checks if the Prism folder exists.
   *
   * @returns {boolean} `true` if the Prism folder exists, otherwise `false`.
   */
  static isPrismFolderExists(): boolean {
    return fs.existsSync(this.getPrismFolderPath())
  }

  /**
   * Retrieves the path to the Prism documentation folder.
   *
   * @returns {string} The path to the Prism documentation folder.
   */
  static getPrismDocsFolderPath(): string {
    // const root = vscode.Uri.file(this.getPrismFolderPath() ?? '')

    // // Initialize the current path to the root
    // let currentPath = root

    // // Split the prism's docs into individual folders
    // const folders = PRISM_DOCS_FOLDER_NAME.split('/')

    // // Iterate through each folder in the prism's docs
    // for (const folder of folders) {
    //   const files = await vscode.workspace.fs.readDirectory(currentPath)
    //   const target = files.find(([name, type]) => type === vscode.FileType.Directory && name === folder)
    //   if (!target) {
    //     return null
    //   }
    //   // Update the current path
    //   currentPath = vscode.Uri.joinPath(currentPath, folder)
    // }

    // return `${root.path}/${PRISM_DOCS_FOLDER_NAME}`

    return path.join(this.getPrismFolderPath(), PRISM_DOCS_FOLDER_NAME)
  }

  /**
   * Checks if the Prism documentation folder exists.
   *
   * @returns {boolean} `true` if the Prism documentation folder exists, otherwise `false`.
   */
  static isPrismDocsFolderExists(): boolean {
    return fs.existsSync(this.getPrismDocsFolderPath())
  }

  /**
   * Generates the full file path for a given prism file name.
   *
   * @param name - The name of the prism file without extension.
   * @returns The full file path including the prism folder path and file extension.
   */
  static getPrismFilePath(name: string): string {
    return path.join(this.getPrismFolderPath(), `${name}.${PRISM_FILE_EXT}`)
  }

  /**
   * Checks if a prism file with the given name exists.
   *
   * @param name - The name of the prism file to check.
   * @returns `true` if the prism file exists, otherwise `false`.
   */
  static isPrismFileExists(name: string): boolean {
    return fs.existsSync(this.getPrismFilePath(name))
  }

  /**
   * Computes the relative path from the workspace path to the given file path.
   *
   * @param filePath - The absolute path of the file.
   * @returns The relative path from the workspace path to the given file path.
   */
  static getRelativePath(filePath: string): string {
    return path.relative(this.getWorkspacePath() ?? '', filePath)
  }

  /**
   * Creates a new Prism file and saves it.
   *
   * @param prism - The Prism object containing the data to be saved in the file.
   *
   * @remarks
   * This method is responsible for creating a new file for the given Prism object.
   * The actual file creation logic is currently commented out, and the method
   * directly calls `savePrismFile` to save the Prism data.
   */
  static async createPrismFile(prism: Prism): Promise<boolean> {
    // const workspaceEdit = new vscode.WorkspaceEdit();
    // workspaceEdit.createFile(vscode.Uri.file(this.getPrismFilePath(fileName)), {overwrite: false});
    // workspaceEdit.createFile(vscode.Uri.file(prismDocFilePath), {overwrite: false});
    // await vscode.workspace.applyEdit(workspaceEdit);

    this.savePrismFile(prism)
    return true
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
  static async deletePrismFile(fileName: string): Promise<boolean> {
    // if (this.isPrismFileExists(fileName)) {
    //   fs.unlinkSync(this.getPrismFilePath(fileName))
    // }
    // const files = fs.readdirSync(this.getPrismFolderPath())
    // if (files.length === 0) {
    //   fs.rmdirSync(this.getPrismFolderPath())
    // }

    const filePath = this.getPrismFilePath(fileName)
    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.deleteFile(vscode.Uri.file(filePath))
    await vscode.workspace.applyEdit(workspaceEdit)
    return true
  }

  /**
   * Saves the given Prism object to a file.
   * 이것은 this.prisms를 변경하지 않기 때문에 내부적으로만 사용한다.
   *
   * @param prism - The Prism object to be saved.
   * @remarks
   * This method writes the Prism object to a file using the file system's synchronous write method.
   * The file path is determined by the prism's name.
   */
  static async savePrismFile(prism: Prism): Promise<boolean> {
    const prismFolderPath = this.getPrismFolderPath()
    if (!fs.existsSync(prismFolderPath)) {
      fs.mkdirSync(prismFolderPath)
    }

    fs.writeFileSync(this.getPrismFilePath(prism.name), prism.toString())
    return true
  }

  /**
   * Creates a markdown file for the given prism.
   *
   * @param name - The name of the markdown file to be created.
   * @param prism - An optional Prism object to be used for generating the markdown content.
   *
   * This method will create a 'docs' folder inside the prism folder if it does not exist.
   * If a markdown file with the given name already exists, the method will return without making any changes.
   * Otherwise, it will generate the markdown content using the PrismBuilder and write it to the new file.
   */
  static async createMarkdownFile(name: string, prism?: Prism, issue?: Issue): Promise<boolean> {
    const prismFolderPath = this.getPrismFolderPath()
    if (!fs.existsSync(prismFolderPath)) {
      fs.mkdirSync(prismFolderPath)
    }

    const prismDocsFolderPath = this.getPrismDocsFolderPath()
    if (!fs.existsSync(prismDocsFolderPath)) {
      fs.mkdirSync(prismDocsFolderPath)
    }

    const markdownFilePath = path.resolve(prismDocsFolderPath, name + '.md')
    if (fs.existsSync(markdownFilePath)) {
      return false
    }

    // markdown link는 절대경로, 상대경로, 프로젝트 루트 경로등을 모두 지원한다.
    // 하지만 마크다운이 랜더링되어졌을 때와 랜더링되기 전의 텍스트 상태일때를 모두 지원해야 한다.
    // 랜더링 후의 링크는 마크다운이 처리하지만 이전의 링크는 PrismLinkProvider에서 처리한다.
    // 소스 파일의 경로는 workspace root 기준 경로이고 마크다운의 특성상 workspace 경로는 '/'가 필요한데
    // 이미 그렇게 되어져 있기 때문에 그냥 사용하면 된다.
    const title = prism ? prism.name : name
    let source = ''
    if (issue) {
      source = issue.source.file + '#' + issue.source.startLine + '-#' + issue.source.endLine
    }

    const content = `# ${name}\n
This is the markdown file for '${title}'.\n\n[code](${source}): ${PrismFileManager.getWorkspacePath()}${source}\n
You can edit this file to add more information about ${title}.\n\n`

    fs.writeFileSync(markdownFilePath, content)
    return true
  }

  /**
   * Reads the content of a file synchronously.
   *
   * @param fileName - The path to the file to be read.
   * @returns The content of the file as a string. If the file does not exist, returns an empty string.
   */
  static readFile(fileName: string): string {
    // const fileExtRegex = /(?:\.([^.]+))?$/
    // const fileExtension = fileExtRegex.exec(fileName)![1]
    // const rawData = await vscode.workspace.fs.readFile(vscode.Uri.file(fileName))
    // const fileContent = rawData.toString()

    if (fs.existsSync(fileName)) {
      return fs.readFileSync(fileName, 'utf8')
    }
    return ''
  }
}
