import * as vscode from 'vscode'
import * as path from 'path'

/**
 * The `PrismPath` class provides utility methods to retrieve various paths related to the Prism folder within the current workspace.
 */
export namespace PrismPath {
  export const PRISM_FOLDER_NAME = '.prism'
  export const PRISM_FILE_EXT = 'prism.json'

  let workspacePath = ''
  let prismFolderName = PRISM_FOLDER_NAME

  export function activate(context: vscode.ExtensionContext) {
    // const document = vscode.window.activeTextEditor?.document
    // if (document) {
    //   return vscode.workspace.getWorkspaceFolder(document.uri)?.uri?.fsPath ?? ''
    // }

    // 작업 영역의 루트 경로 가져오기
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (workspaceFolders && workspaceFolders.length > 0) {
      workspacePath = workspaceFolders[0].uri.fsPath
    } else {
      console.error('작업 영역이 열려 있지 않습니다.')
    }

    const settings = vscode.workspace.getConfiguration('CodePrism')
    prismFolderName = settings.get<string>('config.PrismFolder') ?? PRISM_FOLDER_NAME

    // 설정 변경 이벤트 리스너 등록
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('CodePrism.config.PrismFolder')) {
        const settings = vscode.workspace.getConfiguration('CodePrism')
        prismFolderName = settings.get<string>('config.PrismFolder') ?? PRISM_FOLDER_NAME
      }
    })
  }

  /**
   * Retrieves the root path of the current workspace.
   * If no workspace is open, an error message is logged to the console.
   * 관련 코드: [[al=52bccd72a41210a6132bba47507d5c92]]
   *
   * @returns {string} The root path of the workspace if available, otherwise empty string.
   */
  export function getWorkspacePath(): string {
    return workspacePath
  }

  /**
   * Retrieves the name of the Prism folder from the workspace configuration.
   * If the configuration is not set, it returns the default Prism folder name.
   * 관련 코드: [[al=8d859200413ba3c2a7089f0422173771]]
   *
   * @returns {string} The name of the Prism folder.
   */
  export function getPrismFolderName(): string {
    return prismFolderName
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
   * Constructs an absolute path by joining the workspace path with the provided file path.
   *
   * @param filePath - The relative file path to be joined with the workspace path.
   * @returns The absolute path as a string.
   */
  export function getAbsolutePath(filePath: string): string {
    return path.join(PrismPath.getWorkspacePath(), filePath)
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
}
