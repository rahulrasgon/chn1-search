import { LitElement, html, noChange, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { classMap } from 'lit/directives/class-map.js';
// import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { Task } from '@lit/task';
import { AdoptedStylesheets } from '@phase2/outline-adopted-stylesheets-controller';
import componentStyles from './outline-yext-vertical.css?inline';
import { ResizeController } from '../../controllers/resize-controller';
import '../outline-yext-pager/outline-yext-pager';
import { displayTeaser } from './teaser';

import type {
  SearchSettings,
  Result,
  VerticalSearchResponseStructure,
} from '../../libraries/data-access-yext/yext-types';

import {
  getStoredSearchSettings,
  syncSearchSettingsInStore,
  setStoredSearchSettings,
} from '../../libraries/data-access-yext/yext-store';
import {
  getYextSearchData,
  isVerticalSearchResponse,
} from '../../libraries/data-access-yext/yext-api';
import TotalCount from '../../libraries/ui-yext/total-count';
import Pending from '../../libraries/ui-yext/pending';

/**
 * The Yext Vertical Search component.
 * @element outline-yext-universal
 */
@customElement('outline-yext-vertical')
export class OutlineYextVertical extends LitElement {
  createRenderRoot() {
    const root = super.createRenderRoot();
    // this.EncapsulatedStylesheets = this.shadowRoot
    //   ? new AdoptedStylesheets(this, componentStyles, this.shadowRoot)
    //   : undefined;
    new AdoptedStylesheets(this, componentStyles, this.shadowRoot!);
    return root;
  }

  pageTitle = '';

  searchSettings: SearchSettings | undefined;

  randomizationToken?: null | string;

  filterTempProfiles = false;

  @property({ type: String, attribute: 'vertical-key' })
  verticalKey = 'blog';

  // @property({ type: Boolean, reflect: true, attribute: 'debug' })
  // debug: null;

  @property({ type: Number, reflect: true, attribute: 'show-results' })
  showResults = 5;

  userLat?: number;
  userLong?: number;

  @state() isFocus = false;

  @state()
  entities?: [];

  @state()
  searchSuggestions: Result[] = [];

  @state() modalFiltersOpenClose = false;

  @state() searchFacetValues?: {
    [key: string]: string;
  };

  @state()
  totalCount?: null | number;

  taskValue: unknown;

  connectedCallback() {
    super.connectedCallback();
    this.initializeSearchSettings();
    this.pageTitle = this.verticalKey || '';
  }

  initializeSearchSettings() {
    syncSearchSettingsInStore();
    this.searchSettings = {
      ...getStoredSearchSettings(),
      limit: 16,
    };
    setStoredSearchSettings(this.searchSettings);
  }

  /**
   * Handles a page change event, updating the data offset and triggering data retrieval.
   *
   * This function is typically used in pagination systems to respond to a page change event.
   * It calculates the data offset based on the clicked page number and updates the offset
   * in the search settings. Then, it triggers a data retrieval action, such as an API call.
   *
   * @param {Event} event - The page change event, typically a click event.
   */
  handlePageChange(event: Event) {
    if (!this.searchSettings) {
      return;
    }

    const pageClicked = (event.target as HTMLElement).getAttribute(
      'current-page'
    );

    // Check if pageClicked is not null and is a valid number
    if (pageClicked !== null && !isNaN(Number(pageClicked))) {
      const offset =
        (Number(pageClicked) - 1) * (this.searchSettings.limit ?? 0);
      this.searchSettings.offset = offset;
      setStoredSearchSettings(this.searchSettings);
      this.fetchEndpoint.run();
    }
  }

  resizeController = new ResizeController(this, {});

  rawFilters?: {};

  fetchEndpoint = new Task(
    this,
    async () => getYextSearchData({ verticalKey: this.verticalKey }),
    () => [this.entities]
  );

  displayAll(response: VerticalSearchResponseStructure) {
    if (this.totalCount === 0) {
      return html` <h2>No results found</h2> `;
    }

    // this.randomizationToken = response.randomizationToken;
    // this.userLat = Number(response.locationBias?.latitude);
    // this.userLong = Number(response.locationBias?.longitude);

    return html`
      <ul class="results-list">
        ${repeat(
          response.results,
          result => result,
          (result, index) => html`
            <li class="result" data-index=${index}>
              ${displayTeaser(this.verticalKey, result)}
            </li>
          `
        )}
      </ul>
    `;
  }

  debugTemplate(data: {}): TemplateResult {
    return html`
      <details class="debug">
        <summary></summary>
        <div>
          <pre>${JSON.stringify(data, null, 2)}</pre>
        </div>
      </details>
    `;
  }

  _focusIn() {
    if (!this.searchSettings) {
      return;
    }

    if (
      this.searchSettings.input.length > 3 &&
      this.searchSuggestions.length > 0
    ) {
      this.isFocus = true;
    }
  }
  _focusOut(e: FocusEvent) {
    const currentTarget = e.currentTarget as Node;
    const relatedTarget = e.relatedTarget as Node;
    if (relatedTarget === null) {
      this.isFocus = false;
    }

    if (!!relatedTarget && !currentTarget.contains(relatedTarget)) {
      this.isFocus = false;
    }
  }

  render(): TemplateResult {
    if (!this.searchSettings) {
      return html``;
    }

    if (this.fetchEndpoint.value !== undefined) {
      this.taskValue = this.fetchEndpoint.value;
    }

    const classes = {
      wrapper: true,
      isMobile: this.resizeController.currentBreakpointRange === 0,
    };

    return html`
      <div>
        <div class="${classMap(classes)}">
          <main>
            ${TotalCount({
              totalCount: this.totalCount ?? null,
              limit: this.searchSettings.limit,
              offset: this.searchSettings.offset,
            })}
            ${this.fetchEndpoint.render({
              pending: () => (this.taskValue ? Pending() : noChange),
              complete: data => {
                if (!data) {
                  return;
                }

                if (!isVerticalSearchResponse(data.response)) {
                  return;
                }

                this.totalCount = data.response.resultsCount;

                // @todo why doesn't the component refresh when the totalCount state changes?
                setTimeout(() => {
                  this.requestUpdate();
                }, 0);

                return this.displayAll(data.response);
              },
              // error: error => html`${error}`,
            })}
            ${this.totalCount
              ? html`
                  <outline-yext-pager
                    current-page=${this.searchSettings.offset /
                      (this.searchSettings.limit ?? 0) +
                    1}
                    total-pages=${Math.ceil(
                      this.totalCount / (this.searchSettings.limit ?? 0)
                    )}
                    @click=${(e: Event) => this.handlePageChange(e)}
                    aria-live="polite"
                  ></outline-yext-pager>
                `
              : null}
          </main>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'outline-yext-vertical': OutlineYextVertical;
  }
}
