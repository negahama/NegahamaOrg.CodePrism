## CreateFileSystemWatcher 사용법

```ts
const globalWatcher = vscode.workspace.createFileSystemWatcher(
  new vscode.RelativePattern(vscode.Uri.file(globalNotesFolder), '*.{md,MD,Md,mD}')
)
globalWatcher.onDidCreate(uri => GlobalOutlineProvider.refresh()) // Listen to files/folders being created
globalWatcher.onDidDelete(uri => GlobalOutlineProvider.refresh()) // Listen to files/folders getting deleted
```

````ts
/**
 * Creates a file system watcher that is notified on file events (create, change, delete)
 * depending on the parameters provided.
 *
 * By default, all opened {@link workspace.workspaceFolders workspace folders} will be watched
 * for file changes recursively.
 *
 * Additional paths can be added for file watching by providing a {@link RelativePattern} with
 * a `base` path to watch. If the path is a folder and the `pattern` is complex (e.g. contains
 * `**` or path segments), it will be watched recursively and otherwise will be watched
 * non-recursively (i.e. only changes to the first level of the path will be reported).
 *
 * *Note* that paths that do not exist in the file system will be monitored with a delay until
 * created and then watched depending on the parameters provided. If a watched path is deleted,
 * the watcher will suspend and not report any events until the path is created again.
 *
 * If possible, keep the use of recursive watchers to a minimum because recursive file watching
 * is quite resource intense.
 *
 * Providing a `string` as `globPattern` acts as convenience method for watching file events in
 * all opened workspace folders. It cannot be used to add more folders for file watching, nor will
 * it report any file events from folders that are not part of the opened workspace folders.
 *
 * Optionally, flags to ignore certain kinds of events can be provided.
 *
 * To stop listening to events the watcher must be disposed.
 *
 * *Note* that file events from recursive file watchers may be excluded based on user configuration.
 * The setting `files.watcherExclude` helps to reduce the overhead of file events from folders
 * that are known to produce many file changes at once (such as `.git` folders). As such,
 * it is highly recommended to watch with simple patterns that do not require recursive watchers
 * where the exclude settings are ignored and you have full control over the events.
 *
 * *Note* that symbolic links are not automatically followed for file watching unless the path to
 * watch itself is a symbolic link.
 *
 * *Note* that the file paths that are reported for having changed may have a different path casing
 * compared to the actual casing on disk on case-insensitive platforms (typically macOS and Windows
 * but not Linux). We allow a user to open a workspace folder with any desired path casing and try
 * to preserve that. This means:
 * * if the path is within any of the workspace folders, the path will match the casing of the
 *   workspace folder up to that portion of the path and match the casing on disk for children
 * * if the path is outside of any of the workspace folders, the casing will match the case of the
 *   path that was provided for watching
 * In the same way, symbolic links are preserved, i.e. the file event will report the path of the
 * symbolic link as it was provided for watching and not the target.
 *
 * ### Examples
 *
 * The basic anatomy of a file watcher is as follows:
 *
 * ```ts
 * const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(<folder>, <pattern>));
 *
 * watcher.onDidChange(uri => { ... }); // listen to files being changed
 * watcher.onDidCreate(uri => { ... }); // listen to files/folders being created
 * watcher.onDidDelete(uri => { ... }); // listen to files/folders getting deleted
 *
 * watcher.dispose(); // dispose after usage
 * ```
 *
 * #### Workspace file watching
 *
 * If you only care about file events in a specific workspace folder:
 *
 * ```ts
 * vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '**​/*.js'));
 * ```
 *
 * If you want to monitor file events across all opened workspace folders:
 *
 * ```ts
 * vscode.workspace.createFileSystemWatcher('**​/*.js');
 * ```
 *
 * *Note:* the array of workspace folders can be empty if no workspace is opened (empty window).
 *
 * #### Out of workspace file watching
 *
 * To watch a folder for changes to *.js files outside the workspace (non recursively), pass in a `Uri` to such
 * a folder:
 *
 * ```ts
 * vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(<path to folder outside workspace>), '*.js'));
 * ```
 *
 * And use a complex glob pattern to watch recursively:
 *
 * ```ts
 * vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(<path to folder outside workspace>), '**​/*.js'));
 * ```
 *
 * Here is an example for watching the active editor for file changes:
 *
 * ```ts
 * vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.window.activeTextEditor.document.uri, '*'));
 * ```
 *
 * @param globPattern A {@link GlobPattern glob pattern} that controls which file events the watcher should report.
 * @param ignoreCreateEvents Ignore when files have been created.
 * @param ignoreChangeEvents Ignore when files have been changed.
 * @param ignoreDeleteEvents Ignore when files have been deleted.
 * @returns A new file system watcher instance. Must be disposed when no longer needed.
 */
export function createFileSystemWatcher(
  globPattern: GlobPattern,
  ignoreCreateEvents?: boolean,
  ignoreChangeEvents?: boolean,
  ignoreDeleteEvents?: boolean
): FileSystemWatcher

/**
 * A relative pattern is a helper to construct glob patterns that are matched
 * relatively to a base file path. The base path can either be an absolute file
 * path as string or uri or a {@link WorkspaceFolder workspace folder}, which is the
 * preferred way of creating the relative pattern.
 */
export class RelativePattern {
  /**
   * A base file path to which this pattern will be matched against relatively. The
   * file path must be absolute, should not have any trailing path separators and
   * not include any relative segments (`.` or `..`).
   */
  baseUri: Uri

  /**
   * A base file path to which this pattern will be matched against relatively.
   *
   * This matches the `fsPath` value of {@link RelativePattern.baseUri}.
   *
   * *Note:* updating this value will update {@link RelativePattern.baseUri} to
   * be a uri with `file` scheme.
   *
   * @deprecated This property is deprecated, please use {@link RelativePattern.baseUri} instead.
   */
  base: string

  /**
   * A file glob pattern like `*.{ts,js}` that will be matched on file paths
   * relative to the base path.
   *
   * Example: Given a base of `/home/work/folder` and a file path of `/home/work/folder/index.js`,
   * the file glob pattern will match on `index.js`.
   */
  pattern: string

  /**
   * Creates a new relative pattern object with a base file path and pattern to match. This pattern
   * will be matched on file paths relative to the base.
   *
   * Example:
   * ```ts
   * const folder = vscode.workspace.workspaceFolders?.[0];
   * if (folder) {
   *
   *   // Match any TypeScript file in the root of this workspace folder
   *   const pattern1 = new vscode.RelativePattern(folder, '*.ts');
   *
   *   // Match any TypeScript file in `someFolder` inside this workspace folder
   *   const pattern2 = new vscode.RelativePattern(folder, 'someFolder/*.ts');
   * }
   * ```
   *
   * @param base A base to which this pattern will be matched against relatively. It is recommended
   * to pass in a {@link WorkspaceFolder workspace folder} if the pattern should match inside the workspace.
   * Otherwise, a uri or string should only be used if the pattern is for a file path outside the workspace.
   * @param pattern A file glob pattern like `*.{ts,js}` that will be matched on paths relative to the base.
   */
  constructor(base: WorkspaceFolder | Uri | string, pattern: string)
}
````
