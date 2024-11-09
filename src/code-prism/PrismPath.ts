import * as vscode from 'vscode'
import * as path from 'path'

/**
 * The `PrismPath` class provides utility methods to retrieve various paths related to the Prism folder within the current workspace.
 */
export namespace PrismPath {
  export const PRISM_FOLDER_NAME = '.prism'
  export const PRISM_FILE_EXT = 'prism.json'

  /**
   * Retrieves the root path of the current workspace.
   *
   * @returns {string} The root path of the workspace if available, otherwise empty string.
   *
   * @remarks
   * If no workspace is open, an error message is logged to the console.
   */
  export function getWorkspacePath(): string {
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
    return ''
  }

  /**
   * Retrieves the name of the Prism folder from the workspace configuration.
   * If the configuration is not set, it returns the default Prism folder name.
   *
   * @returns {string} The name of the Prism folder.
   */
  export function getPrismFolderName(): string {
    const settings = vscode.workspace.getConfiguration('CodePrism')
    return settings.get<string>('config.PrismFolder') ?? PRISM_FOLDER_NAME
  }

  /**
   * Retrieves the full path to the Prism folder within the workspace.
   *
   * @returns {string} The full path to the Prism folder.
   */
  export function getPrismFolderPath(): string {
    return path.join(getWorkspacePath(), getPrismFolderName())
  }

  /**
   * Generates the full file path for a given prism file name.
   *
   * @param name - The name of the prism file without extension.
   * @returns The full file path including the prism folder path and file extension.
   */
  export function getPrismFilePath(name: string): string {
    return path.join(getPrismFolderPath(), `${name}.${PRISM_FILE_EXT}`)
  }

  /**
   * Computes the relative path from the workspace path to the given file path.
   *
   * @param filePath - The absolute path of the file.
   * @returns The relative path from the workspace path to the given file path.
   */
  export function getRelativePath(filePath: string): string {
    return path.relative(getWorkspacePath(), filePath)
  }

  /**
   * Retrieves the path to the Prism documentation folder.
   *
   * @returns {string} The path to the Prism documentation folder.
   */
  export function getPrismDocsFolderPath(): string {
    const PRISM_DOCS_FOLDER_NAME = 'docs'

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

    return path.join(getPrismFolderPath(), PRISM_DOCS_FOLDER_NAME)
  }

  export function getPrismSnippetFolderPath(): string {
    return path.join(getPrismFolderPath(), 'snippets')
  }
}
