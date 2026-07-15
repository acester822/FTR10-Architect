import { utility } from 'crossnote';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { getMPEConfig } from './config';
import { getWorkspaceFolderUri, isMarkdownFile } from './utils';

/**
 * Copy ans paste image at imageFilePath to config.imageForlderPath.
 * Then insert markdown image url to markdown file.
 * @param uri
 * @param imageFilePath
 */
async function getMarkdownEditorForUri(
  sourceUri: vscode.Uri,
): Promise<vscode.TextEditor | undefined> {
  const matchingEditor = vscode.window.visibleTextEditors.find(
    (editor) =>
      isMarkdownFile(editor.document) &&
      editor.document.uri.toString() === sourceUri.toString(),
  );
  if (matchingEditor) {
    return matchingEditor;
  }

  try {
    const editor = await vscode.window.showTextDocument(sourceUri, {
      preserveFocus: true,
      preview: true,
    });
    if (editor && isMarkdownFile(editor.document)) {
      return editor;
    }
  } catch {
    // ignore errors when the editor cannot be opened
  }

  return undefined;
}

export type ImageFilePayload = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

function isImageFilePayload(
  source: string | ImageFilePayload,
): source is ImageFilePayload {
  return (
    !!source &&
    typeof source === 'object' &&
    typeof (source as ImageFilePayload).dataUrl === 'string'
  );
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const commaIndex = dataUrl.indexOf(',');
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  return Buffer.from(base64, 'base64');
}

export async function pasteImageFile(
  sourceUri: string,
  imageFilePath: string | ImageFilePayload,
) {
  const uri = vscode.Uri.parse(sourceUri);
  const editor = await getMarkdownEditorForUri(uri);
  if (!editor) {
    return vscode.window.showErrorMessage(
      'Cannot insert image: source markdown file is not open.',
    );
  }

  const imageFolderPath =
    vscode.workspace
      .getConfiguration('markdown-preview-aces-edition')
      .get<string>('imageFolderPath') ?? '';
  let imageFileName = isImageFilePayload(imageFilePath)
    ? imageFilePath.fileName
    : path.basename(imageFilePath);
  const projectDirectoryPath = getWorkspaceFolderUri(uri).fsPath;
  if (!projectDirectoryPath) {
    return vscode.window.showErrorMessage('Cannot find workspace');
  }

  let assetDirectoryPath;
  let description;
  if (imageFolderPath[0] === '/') {
    assetDirectoryPath = path.resolve(
      projectDirectoryPath,
      '.' + imageFolderPath,
    );
  } else {
    assetDirectoryPath = path.resolve(
      path.dirname(uri.fsPath),
      imageFolderPath,
    );
  }

  const sourceFilePath =
    isImageFilePayload(imageFilePath) ? undefined : imageFilePath;
  const destPath = path.resolve(assetDirectoryPath, imageFileName);

  fs.mkdir(assetDirectoryPath, { recursive: true }, (error) => {
    if (error) {
      return vscode.window.showErrorMessage(error.toString());
    }

    fs.stat(destPath, (err) => {
      const writeFile = (targetPath: string, buffer?: Buffer) => {
        const finish = () => {
          vscode.window.showInformationMessage(
            `Image ${imageFileName} has been copied to folder ${assetDirectoryPath}`,
          );

          let url = `${imageFolderPath}/${imageFileName}`;
          if (url.indexOf(' ') >= 0) {
            url = url.replace(/ /g, '%20');
          }

          editor.edit((textEditorEdit) => {
            textEditorEdit.insert(
              editor.selection.active,
              `![${description}](${url})`,
            );
          });
        };

        if (buffer) {
          fs.writeFile(targetPath, buffer, (writeErr) => {
            if (writeErr) {
              return vscode.window.showErrorMessage(writeErr.toString());
            }
            finish();
          });
        } else {
          fs.copyFile(sourceFilePath!, targetPath, (copyErr) => {
            if (copyErr) {
              return vscode.window.showErrorMessage(copyErr.toString());
            }
            finish();
          });
        }
      };

      if (err == null) {
        const lastDotOffset = imageFileName.lastIndexOf('.');
        const uid =
          '_' +
          Math.random()
            .toString(36)
            .substr(2, 9);

        if (lastDotOffset > 0) {
          description = imageFileName.slice(0, lastDotOffset);
          imageFileName =
            imageFileName.slice(0, lastDotOffset) +
            uid +
            imageFileName.slice(lastDotOffset, imageFileName.length);
        } else {
          description = imageFileName;
          imageFileName = imageFileName + uid;
        }

        const targetPath = path.resolve(assetDirectoryPath, imageFileName);
        if (isImageFilePayload(imageFilePath)) {
          writeFile(targetPath, dataUrlToBuffer(imageFilePath.dataUrl));
        } else {
          writeFile(targetPath);
        }
      } else if (err.code === 'ENOENT') {
        if (imageFileName.lastIndexOf('.')) {
          description = imageFileName.slice(
            0,
            imageFileName.lastIndexOf('.'),
          );
        } else {
          description = imageFileName;
        }

        if (isImageFilePayload(imageFilePath)) {
          writeFile(destPath, dataUrlToBuffer(imageFilePath.dataUrl));
        } else {
          writeFile(destPath);
        }
      } else {
        return vscode.window.showErrorMessage(err.toString());
      }
    });
  });
}

function replaceHint(
  editor: vscode.TextEditor,
  line: number,
  hint: string,
  withStr: string,
): boolean {
  const textLine = editor.document.lineAt(line);
  if (textLine.text.indexOf(hint) >= 0) {
    editor.edit((textEdit) => {
      textEdit.replace(
        new vscode.Range(
          new vscode.Position(line, 0),
          new vscode.Position(line, textLine.text.length),
        ),
        textLine.text.replace(hint, withStr),
      );
    });
    return true;
  }
  return false;
}

function setUploadedImageURL(
  imageFileName: string,
  url: string,
  editor: vscode.TextEditor,
  hint: string,
  curPos: vscode.Position,
) {
  let description;
  if (imageFileName.lastIndexOf('.')) {
    description = imageFileName.slice(0, imageFileName.lastIndexOf('.'));
  } else {
    description = imageFileName;
  }

  const withStr = `![${description}](${url})`;

  if (!replaceHint(editor, curPos.line, hint, withStr)) {
    let i = curPos.line - 20;
    while (i <= curPos.line + 20) {
      if (replaceHint(editor, i, hint, withStr)) {
        break;
      }
      i++;
    }
  }
}

/**
 * Upload image at imageFilePath to config.imageUploader.
 * Then insert markdown image url to markdown file.
 * @param uri
 * @param imageFilePath
 */
export async function uploadImageFile(
  sourceUri: any,
  imageFilePath: string | ImageFilePayload,
  imageUploader: string,
) {
  // console.log('uploadImageFile', sourceUri, imageFilePath, imageUploader)
  if (typeof sourceUri === 'string') {
    sourceUri = vscode.Uri.parse(sourceUri);
  }
  const imageFileName = isImageFilePayload(imageFilePath)
    ? imageFilePath.fileName
    : path.basename(imageFilePath);

  const editor = await getMarkdownEditorForUri(sourceUri);
  if (!editor) {
    return vscode.window.showErrorMessage(
      'Cannot insert image: source markdown file is not open.',
    );
  }

  const uid = Math.random()
    .toString(36)
    .substr(2, 9);
  const hint = `![Uploading ${imageFileName}… (${uid})]()`;
  const curPos = editor.selection.active;

  editor.edit((textEditorEdit) => {
    textEditorEdit.insert(curPos, hint);
  });

  const AccessKey = getMPEConfig<string>('qiniuAccessKey') || '';
  const SecretKey = getMPEConfig<string>('qiniuSecretKey') || '';
  const Bucket = getMPEConfig<string>('qiniuBucket') || '';
  const Domain = getMPEConfig<string>('qiniuDomain') || '';

  const uploadPath = isImageFilePayload(imageFilePath)
    ? path.join(os.tmpdir(), `${Date.now()}-${imageFileName}`)
    : imageFilePath;

  const performUpload = () => {
    utility
      .uploadImage(uploadPath, {
        method: imageUploader,
        qiniu: { AccessKey, SecretKey, Bucket, Domain },
      })
      .then((url) => {
        setUploadedImageURL(imageFileName, url, editor, hint, curPos);
        if (isImageFilePayload(imageFilePath)) {
          fs.unlink(uploadPath, () => {});
        }
      })
      .catch((error) => {
        vscode.window.showErrorMessage(error.toString());
        if (isImageFilePayload(imageFilePath)) {
          fs.unlink(uploadPath, () => {});
        }
      });
  };

  if (isImageFilePayload(imageFilePath)) {
    fs.writeFile(uploadPath, dataUrlToBuffer(imageFilePath.dataUrl), (err) => {
      if (err) {
        return vscode.window.showErrorMessage(err.toString());
      }
      performUpload();
    });
  } else {
    performUpload();
  }
}
