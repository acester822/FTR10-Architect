import {
  mdiExportVariant,
  mdiImageOutline,
  mdiInformationOutline,
  mdiOpenInNew,
  mdiPencil,
  mdiPublish,
  mdiSync,
} from '@mdi/js';
import Icon from '@mdi/react';
import React, { useCallback } from 'react';
import { Item, ItemParams, Menu, Separator, Submenu } from 'react-contexify';
import 'react-contexify/ReactContexify.css';
import PreviewContainer from '../containers/preview';

export default function ContextMenu() {
  const {
    contextMenuId,
    isVSCode,
    isVSCodeWebExtension,
    postMessage,
    previewSyncSource,
    setShowImageHelper,
    sourceUri,
    theme,
  } = PreviewContainer.useContainer();

  const handleItemClick = useCallback(
    ({ id }: ItemParams<unknown, unknown>) => {
      switch (id) {
        case 'open-in-browser': {
          postMessage('openInBrowser', [sourceUri.current]);
          break;
        }
        case 'publish': {
          postMessage('publish', [sourceUri.current]);
          break;
        }
        case 'export-html-offline': {
          postMessage('htmlExport', [sourceUri.current, true]);
          break;
        }
        case 'export-html-cdn': {
          postMessage('htmlExport', [sourceUri.current, false]);
          break;
        }
        case 'export-chrome-pdf': {
          postMessage('chromeExport', [sourceUri.current, 'pdf']);
          break;
        }
        case 'export-chrome-png': {
          postMessage('chromeExport', [sourceUri.current, 'png']);
          break;
        }
        case 'export-chrome-jpeg': {
          postMessage('chromeExport', [sourceUri.current, 'jpeg']);
          break;
        }
        case 'export-prince': {
          postMessage('princeExport', [sourceUri.current]);
          break;
        }
        case 'export-ebook-epub': {
          postMessage('eBookExport', [sourceUri.current, 'epub']);
          break;
        }
        case 'export-ebook-mobi': {
          postMessage('eBookExport', [sourceUri.current, 'mobi']);
          break;
        }
        case 'export-ebook-pdf': {
          postMessage('eBookExport', [sourceUri.current, 'pdf']);
          break;
        }
        case 'export-ebook-html': {
          postMessage('eBookExport', [sourceUri.current, 'html']);
          break;
        }
        case 'export-pandoc': {
          postMessage('pandocExport', [sourceUri.current]);
          break;
        }
        case 'export-markdown': {
          postMessage('markdownExport', [sourceUri.current]);
          break;
        }
        case 'open-image-helper': {
          setShowImageHelper(true);
          break;
        }
        case 'sync-source': {
          previewSyncSource();
          break;
        }
        case 'open-external-editor': {
          postMessage('openExternalEditor', [sourceUri.current]);
          break;
        }
        case 'open-documentation': {
          postMessage('openDocumentation');
          break;
        }
        case 'open-changelog': {
          postMessage('openChangelog');
          break;
        }
        case 'open-issues': {
          postMessage('openIssues');
          break;
        }
        case 'open-sponsors': {
          postMessage('openSponsors');
          break;
        }
        default:
          break;
      }
    },
    [postMessage, previewSyncSource, setShowImageHelper, sourceUri],
  );

  return (
    <div data-theme={theme} className="select-none">
      <Menu id={contextMenuId} theme={theme === 'dark' ? 'dark' : undefined}>
        {!isVSCodeWebExtension && (
          <>
            <Item id="open-in-browser" onClick={handleItemClick}>
              <Icon path={mdiOpenInNew} size={0.8} className="mr-2"></Icon> Open
              in Browser
            </Item>
            <Item id="publish" onClick={handleItemClick}>
              <Icon path={mdiPublish} size={0.8} className="mr-2"></Icon>
              Publish HTML
            </Item>
            <Separator></Separator>
          </>
        )}
        {!isVSCodeWebExtension && (
          <Submenu
            label={
              <span className="inline-flex flex-row items-center">
                <Icon
                  path={mdiExportVariant}
                  size={0.8}
                  className="mr-2"
                ></Icon>
                Export
              </span>
            }
          >
            <Submenu
              label={
                <span className="inline-flex flex-row items-center">HTML</span>
              }
            >
              <Item id="export-html-offline" onClick={handleItemClick}>
                {'HTML (offline)'}
              </Item>
              <Item id="export-html-cdn" onClick={handleItemClick}>
                {'HTML (cdn hosted)'}
              </Item>
            </Submenu>
            <Submenu
              label={
                <span className="inline-flex flex-row items-center">
                  Chrome (Puppeteer)
                </span>
              }
            >
              <Item id="export-chrome-pdf" onClick={handleItemClick}>
                PDF
              </Item>
              <Item id="export-chrome-png" onClick={handleItemClick}>
                PNG
              </Item>
              <Item id="export-chrome-jpeg" onClick={handleItemClick}>
                JPEG
              </Item>
            </Submenu>
            <Item id="export-prince" onClick={handleItemClick}>
              <span className="inline-flex flex-row items-center">
                PDF (Prince)
              </span>
            </Item>
            <Submenu
              label={
                <span className="inline-flex flex-row items-center">eBook</span>
              }
            >
              <Item id="export-ebook-epub" onClick={handleItemClick}>
                ePub
              </Item>
              <Item id="export-ebook-mobi" onClick={handleItemClick}>
                Mobi
              </Item>
              <Item id="export-ebook-pdf" onClick={handleItemClick}>
                PDF
              </Item>
              <Item id="export-ebook-html" onClick={handleItemClick}>
                HTML
              </Item>
            </Submenu>
            <Item id="export-pandoc" onClick={handleItemClick}>
              <span className="inline-flex flex-row items-center">Pandoc</span>
            </Item>
            <Item id="export-markdown" onClick={handleItemClick}>
              <span className="inline-flex flex-row items-center">
                Save as Markdown
              </span>
            </Item>
          </Submenu>
        )}
        {!isVSCodeWebExtension && <Separator></Separator>}
        <Item id="open-external-editor" onClick={handleItemClick}>
          <span className="inline-flex flex-row items-center">
            <Icon path={mdiPencil} size={0.8} className="mr-2"></Icon>
            {isVSCode ? 'Open VS Code Editor' : 'Open External Editor'}
          </span>
        </Item>
        <Separator></Separator>
        {!isVSCodeWebExtension && (
          <>
            <Item id="open-image-helper" onClick={handleItemClick}>
              <span className="inline-flex flex-row items-center">
                <Icon path={mdiImageOutline} size={0.8} className="mr-2"></Icon>
                Image Helper
              </span>
            </Item>
            <Separator></Separator>
          </>
        )}
        <Item id="sync-source" onClick={handleItemClick}>
          <span className="inline-flex flex-row items-center">
            <Icon path={mdiSync} size={0.8} className="mr-2"></Icon>
            Sync Source
          </span>
        </Item>
        <Separator></Separator>
        <Submenu
          label={
            <span className="inline-flex flex-row items-center">
              <Icon
                path={mdiInformationOutline}
                size={0.8}
                className="mr-2"
              ></Icon>
              About
            </span>
          }
        >
          <Item id="open-documentation" onClick={handleItemClick}>
            Documentation
          </Item>
          <Item id="open-changelog" onClick={handleItemClick}>
            Change Log
          </Item>
          <Item id="open-issues" onClick={handleItemClick}>
            Feature Requests or Bug Reports
          </Item>
          <Item id="open-sponsors" onClick={handleItemClick}>
            Sponsor This Project 😊
          </Item>
        </Submenu>
      </Menu>
    </div>
  );
}
