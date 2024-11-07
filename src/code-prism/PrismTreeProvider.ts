import * as vscode from 'vscode'
import assert from 'assert'

import { Prism, Issue } from './Prism'
import { PrismManager, SubscribeType } from './PrismManager'

/**
 * Represents an prism item in the VS Code tree view.
 * This class extends the `vscode.TreeItem` class and adds a `prism` property
 *
 * @extends vscode.TreeItem
 */
export class PrismItem extends vscode.TreeItem {
  /**
   * Constructs a new instance of the PrismItem.
   *
   * @param prism - The Prism instance associated with this tree item.
   */
  constructor(public readonly prism: Prism) {
    super(prism.name, vscode.TreeItemCollapsibleState.Collapsed)

    // 여기서는 prism의 내용이 변경되더라도 변경되지 않는 항목들만 설정한다.
    this.tooltip = prism.name
    this.iconPath = new vscode.ThemeIcon('file-code', new vscode.ThemeColor('terminal.ansiGreen'))

    // contextValue는 'contributes/menus/view/item/context'에서 prismFile.delete, issue.delete 명령을 구분하기 위해서 사용한다.
    this.contextValue = 'PrismItem'

    // arguments로 [this]를 전달하는 이유는 [prismFile.show 명령 등록](./PrismCommands.ts#105-110)하는 부분을 참조한다.
    this.command = {
      command: 'CodePrism.command.prismFile.show',
      title: 'Open',
      arguments: [this],
    }

    // prism의 내용이 변경되면 갱신되어야 할 것은 모두 refreshItem()에서 처리한다.
    PrismItem.refreshItem(this)
  }

  /**
   * Refreshes the given PrismItem by updating its description.
   *
   * @param item - The PrismItem to be refreshed.
   */
  static refreshItem(item: PrismItem) {
    item.description = this.getDescription(item.prism)
  }

  /**
   * Returns a description of the given prism, including the number of issues it has.
   *
   * @param prism - The prism object for which the description is generated.
   * @returns A string describing the number of issues the prism has.
   */
  static getDescription(prism: Prism) {
    return 'has ' + prism.getIssuesCount().toString() + ' issues'
  }
}

/**
 * Represents a issue item in the VS Code tree view.
 * This class extends the `vscode.TreeItem` class and adds a `issue` property
 *
 * @extends vscode.TreeItem
 */
export class IssueItem extends vscode.TreeItem {
  /**
   * Constructs a new instance of the IssueItem.
   *
   * @param prism - The Prism instance associated with this tree item.
   * @param issue - The Issue instance containing details about the issue.
   * @param parent - The parent PrismItem instance.
   *
   * The label displayed is the first description context of the issue, not the issue's title.
   * The tooltip is set to the issue's title.
   * The icon is set to a comment icon.
   * The command executed is 'CodePrism.command.prismFile.show' with the current instance as an argument.
   */
  constructor(public readonly prism: Prism, public readonly issue: Issue, public readonly parent?: PrismItem) {
    const note = issue.notes && issue.notes.length > 0 ? issue.notes[0] : undefined
    assert.ok(note, 'Issue must have at least one note')

    // 표시되어질 label은 issue의 title이 아니라 issue의 첫번째 note's content이다.
    const label: vscode.TreeItemLabel = {
      label: `${note.category} ▷ ${note.content}`,
      highlights: [[0, note.category.length]],
    }

    // IssueItem은 자식을 가지지 않으므로 vscode.TreeItemCollapsibleState.None을 사용한다.
    super(label, vscode.TreeItemCollapsibleState.None)

    // icon은 commentController와 동일하게 하기 위해 comment icon을 사용한다.
    this.iconPath = new vscode.ThemeIcon('comment', new vscode.ThemeColor('terminal.ansiYellow'))

    // contextValue는 'contributes/menus/view/item/context'에서 prismFile.delete, issue.delete 명령을 구분하기 위해서 사용한다.
    this.contextValue = 'IssueItem'

    // PrismItem과 마찬가지 이유로 arguments로 [this]를 전달하는데 IssueItem은 issue의 값을 참조할 수 있어야 한다.
    this.command = {
      command: 'CodePrism.command.issue.goto',
      title: 'Open',
      arguments: [this],
    }

    // issue의 내용이 변경되면 갱신되어야 할 것은 모두 refreshItem()에서 처리한다.
    IssueItem.refreshItem(this)
  }

  /**
   * Refreshes the given issue item by updating its label and tooltip.
   *
   * @param item - The issue item to refresh.
   *
   * The label is constructed using the first note's category and content, with the category highlighted.
   * The tooltip is created using the issue's title and the note's content, formatted as a Markdown string.
   *
   * @throws Will throw an error if the issue does not have at least one note.
   */
  static refreshItem(item: IssueItem) {
    const note = item.issue.notes && item.issue.notes.length > 0 ? item.issue.notes[0] : undefined
    assert.ok(note, 'Issue must have at least one note')

    const label: vscode.TreeItemLabel = {
      label: `${note.category} ▷ ${note.content}`,
      highlights: [[0, note.category.length]],
    }
    item.label = label

    // tooltip은 issue의 title(즉 marking된 부분의 코드와 파일명)을 사용하며
    // 아울러 note content가 길어서 모두 표시되지 않는 경우를 위해 content도 표시한다.
    const tooltip = new vscode.MarkdownString('$(code) ', true)
    tooltip.appendMarkdown(item.issue.title + '\n\n---\n$(comment) ' + note.content)
    item.tooltip = tooltip
  }
}

/**
 * Represents an element in the tree structure, which can be either a `PrismItem` or a `IssueItem`.
 */
export type PrismTreeViewElement = PrismItem | IssueItem
export type PrismTreeViewViewType = 'tree' | 'list'
export type PrismTreeViewSortType = 'name' | 'cate' | 'time'

/**
 * Provides a data provider for the Prism tree view in Visual Studio Code.
 * Implements the `vscode.TreeDataProvider` interface to supply `PrismItem` elements
 * for the tree view. This class manages the list of Prism items, handles their
 * retrieval, addition, deletion, and refresh operations.
 *
 * @implements {vscode.TreeDataProvider<PrismTreeViewElement>}
 */
export class PrismTreeProvider implements vscode.TreeDataProvider<PrismTreeViewElement> {
  /**
   * An array of TreeElement objects representing the items in the tree.
   * This array is initially empty and can be populated with TreeElement instances.
   */
  private items: PrismTreeViewElement[] = []

  private viewMode: PrismTreeViewViewType = 'tree'
  private sortByName: string = 'asc'
  private sortByCate: string = 'asc'
  private sortByTime: string = 'asc'

  /**
   * Event emitter that triggers when the tree data changes.
   * It emits an event with a `TreeElement` or `undefined` as the payload.
   *
   * @private
   * @type {vscode.EventEmitter<PrismTreeViewElement | undefined>}
   */
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<PrismTreeViewElement | undefined> = 
    new vscode.EventEmitter<PrismTreeViewElement | undefined>()

  /**
   * An event that is fired when the tree data changes.
   *
   * @readonly
   * @type {vscode.Event<PrismTreeViewElement | undefined>}
   */
  readonly onDidChangeTreeData: vscode.Event<PrismTreeViewElement | undefined> = this._onDidChangeTreeData.event

  /**
   * Retrieves the parent of the given tree element.
   *
   * @param element - The tree element for which to get the parent.
   * @returns The parent tree element if the given element is an instance of `IssueItem`, otherwise `undefined`.
   */
  getParent(element: PrismTreeViewElement): vscode.ProviderResult<PrismTreeViewElement> {
    if (element instanceof IssueItem) {
      return element.parent
    }
    return undefined
  }

  /**
   * Retrieves a TreeItem representation of the given PrismFile element.
   *
   * @param element - The PrismFile instance for which to retrieve the TreeItem.
   * @returns The TreeItem representation of the provided PrismFile element.
   */
  getTreeItem(element: PrismTreeViewElement): vscode.TreeItem {
    return element
  }

  /**
   * Retrieves the child elements of a given `PrismFile` element.
   * If no element is provided, it returns the top-level layers.
   *
   * @param element - The `PrismFile` element for which to retrieve children. Optional.
   * @returns A promise that resolves to an array of `PrismFile` objects representing the child elements.
   */
  getChildren(element?: PrismTreeViewElement): Thenable<PrismTreeViewElement[]> {
    if (!element) {
      return Promise.resolve(this.items)
    } else {
      if (this.viewMode === 'list') {
        // list view mode는 children이 없다.
        return Promise.resolve([])
      } else {
        if (element instanceof PrismItem) {
          if (element.prism.issues === undefined) {
            return Promise.resolve([])
          }
          const issues = element.prism.issues.map(issue => new IssueItem(element.prism, issue, element))
          return Promise.resolve(issues)
        } else {
          return Promise.resolve([])
        }
      }
    }
  }

  /**
   * Sorts the items based on the specified sort criteria.
   *
   * @param sort - The criteria to sort the items by. Can be 'name', 'cate', or 'time'.
   *
   * - 'name': Sorts the items by the name of the prism in ascending or descending order.
   * - 'cate': Sorts the items by the category of the first note in the issue in ascending or descending order.
   * - 'time': Sorts the items by the creation time of the first note in the issue in ascending or descending order.
   *
   * The sorting order (ascending or descending) is determined by the respective class properties:
   * - `this.sortByName` for 'name'
   * - `this.sortByCate` for 'cate'
   * - `this.sortByTime` for 'time'
   */
  private sortTreeElements(sort: PrismTreeViewSortType) {
    switch (sort) {
      case 'name': {
        this.items = this.items.sort((a, b) => {
          if (a instanceof PrismItem && b instanceof PrismItem) {
            if (this.sortByName === 'asc') {
              return a.prism.name.localeCompare(b.prism.name)
            } else {
              return b.prism.name.localeCompare(a.prism.name)
            }
          }
          return 0
        })
        break
      }
      case 'cate': {
        this.items = this.items.sort((a, b) => {
          if (a instanceof PrismItem || b instanceof PrismItem) {
            return 0
          }

          const ac = a.issue.notes.length > 0 ? a.issue.notes[0].category : ''
          const bc = b.issue.notes.length > 0 ? b.issue.notes[0].category : ''
          if (this.sortByCate === 'asc') {
            return ac.localeCompare(bc)
          } else {
            return bc.localeCompare(ac)
          }
        })
        break
      }
      case 'time': {
        this.items = this.items.sort((a, b) => {
          if (a instanceof PrismItem || b instanceof PrismItem) {
            return 0
          }

          const ac = a.issue.notes.length > 0 ? a.issue.notes[0].createdAt : ''
          const bc = b.issue.notes.length > 0 ? b.issue.notes[0].createdAt : ''
          if (this.sortByTime === 'asc') {
            return ac.localeCompare(bc)
          } else {
            return bc.localeCompare(ac)
          }
        })
        break
      }
    }
  }

  /**
   * Registers the PrismFileProvider with the VSCode window and subscribes to various PrismManager events.
   *
   * The following events are subscribed to:
   * - `create-prism`: Appends a new prism to the provider.
   * - `delete-prism`: Deletes an existing prism from the provider.
   * - `append-issue`: Appends a issue to an existing prism.
   * - `remove-issue`: Removes a issue from an existing prism.
   */
  register() {
    // vscode.window.registerTreeDataProvider('CodePrism.view.prismView', this)
    // context.subscriptions.push(this)

    // this.onDidChangeTreeData(e => {
    //   console.log('onDidChangeTreeData', e)
    // })

    PrismManager.subscribe('create-prism', (data: SubscribeType) => {
      if (data.prism) {
        this.appendPrismItem(data.prism)
      }
    })

    PrismManager.subscribe('delete-prism', (data: SubscribeType) => {
      if (data.prism) {
        this.deletePrismItem(data.prism)
      }
    })

    PrismManager.subscribe('append-issue', (data: SubscribeType) => {
      this.refreshPrismView()

      // this.refreshPrismView()만으로는 refresh가 되지 않는 경우가 있다.
      // 이 경우 이미 가지고 있는 prism 정보를 이용해서 tree view를 새로 설정한다.
      if (this.viewMode === 'tree') {
        assert.ok(data.prism)

        // Issue를 추가하려고 하는데 이를 담을 PrismItem이 없는 경우
        const prismItem = this.items.find(item => item instanceof PrismItem && item.prism === data.prism)
        if (!prismItem) {
          vscode.window.showWarningMessage('append-issue: No exist data.prism')
          this.reload()
        } else {
          // issue가 추가, 삭제되면 PrismItem의 `has # issues`메시지도 갱신되어야 한다.
          this.updatePrismItem(data.prism)
        }
      } else {
        assert.ok(data.prism)
        assert.ok(data.issue)

        // Issue를 추가하려고 하는데 이미 동일한 IssueItem이 있는 경우
        const issueItem = this.items.find(item => item instanceof IssueItem && item.issue === data.issue)
        if (issueItem) {
          console.warn('append-issue: item.prism === data.prism :', issueItem.prism === data.prism)
          vscode.window.showWarningMessage('append-issue: item.issue === data.issue')
          this.reload()
        } else {
          this.appendIssueItem(data.prism, data.issue)
        }
      }
    })

    PrismManager.subscribe('remove-issue', (data: SubscribeType) => {
      this.refreshPrismView()

      // this.refreshPrismView()만으로는 refresh가 되지 않는 경우가 있다.
      // items 배열의 PrismItem에 prism이 이미 변경되어진 이후에 이것이 호출되므로 this.refreshPrismView()만으로
      // refresh가 될 수 있을 것 같은데 그렇지 않았다. cache되어진 것을 사용하지는 정확히는 모르겠지만 변경된 것과
      // item이 가지고 있는 prism이 다른 경우가 있다.
      if (this.viewMode === 'tree') {
        assert.ok(data.prism)
        const prismItem = this.items.find(item => item instanceof PrismItem && item.prism === data.prism)
        if (!prismItem) {
          vscode.window.showWarningMessage('remove-issue: No exist data.prism')
          this.reload()
        } else {
          // issue가 추가, 삭제되면 PrismItem의 `has # issues`메시지도 갱신되어야 한다.
          this.updatePrismItem(data.prism)
        }
      } else {
        assert.ok(data.prism)
        assert.ok(data.issue)

        // this.items 자체가 IssueItem이기 때문에 tree인 경우와는 다르게 item 내부의 변화가 없다.
        // 따라서 this.refreshPrismView()로 전혀 갱신되지 않는다. 직접 삭제해 주어야 한다.
        // 이미 없는 경우도 확인한다.
        const issueItem = this.items.find(item => item instanceof IssueItem && item.issue === data.issue)
        if (!issueItem) {
          vscode.window.showWarningMessage('remove-issue: No exist data.issue')
          this.reload()
        } else {
          this.deleteIssueItem(data.prism, data.issue)
        }
      }
    })

    PrismManager.subscribe('update-note', (data: SubscribeType) => {
      if (data.prism) {
        assert.ok(data.issue)
        this.updateIssueItem(data.prism, data.issue)
      }
    })

    PrismManager.subscribe('remove-note', (data: SubscribeType) => {
      if (data.prism) {
        assert.ok(data.issue)
        this.deleteIssueItem(data.prism, data.issue)
      }
    })
  }

  /**
   * Refreshes the current items by clearing the existing list and reloading
   * prism files if the prism folder exists. After loading the prism files,
   * it appends each prism to the items list and refreshes the prism view.
   */
  reload(prisms?: Prism[]) {
    this.items = []
    if (!prisms) {
      prisms = PrismManager.getAllPrisms()
    }
    if (this.viewMode === 'tree') {
      prisms.forEach(p => {
        this.appendPrismItem(p)
      })
    } else {
      prisms.forEach(p => {
        p.getIssues().forEach(issue => {
          this.appendIssueItem(p, issue)
        })
      })
    }
    this.refreshPrismView()
  }

  /**
   * Refreshes the Prism view based on the provided mode and sort order.
   *
   * @param view - The view mode to set. If different from the current view mode, the view mode is updated and the items are reloaded.
   *               - 'tree': Displays the prisms in a tree structure.
   *               - 'list': Displays the issues of each prism in a list.
   * @param sort - The sort order to apply to the items.
   *
   * This method updates the view mode and reloads the items accordingly. If the mode is 'tree', it appends each prism item.
   * If the mode is 'list', it appends each issue item of the prisms. It also updates the sort mode and refreshes the Prism view.
   * Additionally, it sets the context for the prism view mode in VS Code.
   */
  async refresh(view: PrismTreeViewViewType | undefined, sort: PrismTreeViewSortType | undefined) {
    if (view && view !== this.viewMode) {
      this.viewMode = view
      this.reload(await PrismManager.loadPrismFiles())
      vscode.commands.executeCommand('setContext', 'CodePrism.context.prismView.isList', view === 'list')
    }

    if (sort) {
      this.sortTreeElements(sort)
      switch (sort) {
        case 'name':
          this.sortByName = this.sortByName === 'asc' ? 'desc' : 'asc'
          break
        case 'cate':
          this.sortByCate = this.sortByCate === 'asc' ? 'desc' : 'asc'
          break
        case 'time':
          this.sortByTime = this.sortByTime === 'asc' ? 'desc' : 'asc'
          break
      }
    }

    this.refreshPrismView()
  }

  /**
   * Refreshes the Prism view by firing the `_onDidChangeTreeData` event.
   * This method triggers an update to the tree data, causing the view to refresh.
   */
  refreshPrismView(data?: PrismTreeViewElement) {
    this._onDidChangeTreeData.fire(data)
  }

  /**
   * Appends a new PrismItem to the items array.
   *
   * @param prism - The Prism object to be converted into a PrismItem and appended.
   */
  appendPrismItem(prism: Prism) {
    if (this.viewMode === 'list') {
      return
    }

    this.items.push(new PrismItem(prism))
    this.refreshPrismView()
  }

  /**
   * Deletes an item from the items array based on the provided label.
   *
   * @param name - The label of the item to be deleted.
   */
  deletePrismItem(prism: Prism) {
    if (this.viewMode === 'list') {
      return
    }

    this.items = this.items.filter(item => item.label !== prism.name)
    this.refreshPrismView()
  }

  /**
   * Updates the specified prism item in the view.
   *
   * This method checks if the current view mode is not 'list'. If it is 'list', the method returns immediately.
   * Otherwise, it searches for the prism item in the list of items. If the prism item is found, it refreshes the item
   * and updates the prism view.
   *
   * @param prism - The prism object to be updated.
   */
  updatePrismItem(prism: Prism) {
    if (this.viewMode === 'list') {
      return
    }

    const prismItem = this.items.find(item => item instanceof PrismItem && item.prism === prism)
    if (prismItem) {
      PrismItem.refreshItem(prismItem)
      this.refreshPrismView(prismItem)
    }
  }

  /**
   * Appends a new issue item to the list of items and refreshes the prism view.
   *
   * @param prism - The prism object to which the issue is related.
   * @param issue - The issue object to be appended.
   */
  appendIssueItem(prism: Prism, issue: Issue) {
    // tree view mode에서는 issue를 별도로 추가할 필요가 없다.
    // issue는 PrismItem의 children으로 getChildren()에서 처리된다.
    if (this.viewMode === 'tree') {
      return
    }

    this.items.push(new IssueItem(prism, issue))
    this.refreshPrismView()
  }

  /**
   * Deletes an item from the items array based on the provided label.
   *
   * @param name - The label of the item to be deleted.
   */
  deleteIssueItem(prism: Prism, issue: Issue) {
    if (this.viewMode === 'tree') {
      return
    }

    this.items = this.items.filter(item => !(item instanceof IssueItem && item.prism === prism && item.issue === issue))
    this.refreshPrismView()
  }

  /**
   * Updates the issue item in the view based on the current view mode.
   * If the view mode is 'tree', the method currently does nothing (todo).
   * Otherwise, it finds the corresponding issue item and refreshes it.
   *
   * @param prism - The Prism object associated with the issue.
   * @param issue - The Issue object to be updated.
   */
  updateIssueItem(prism: Prism, issue: Issue) {
    if (this.viewMode === 'tree') {
      //todo
    } else {
      const issueItem = this.items.find(
        item => item instanceof IssueItem && item.prism === prism && item.issue === issue
      )
      if (issueItem) {
        IssueItem.refreshItem(issueItem as IssueItem)
        this.refreshPrismView(issueItem)
      }
    }
  }
}
