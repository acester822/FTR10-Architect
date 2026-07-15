import React, {
  DragEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import PreviewContainer from '../containers/preview';

type ImageFilePayload = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Unable to read file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export default function ImageHelper() {
  const {
    postMessage,
    showImageHelper,
    setShowImageHelper,
    sourceUri,
    theme,
  } = PreviewContainer.useContainer();
  const imageHelperDialog = useRef<HTMLDialogElement>(null);
  const urlEditor = useRef<HTMLInputElement>(null);
  const imagePasterInput = useRef<HTMLInputElement>(null);

  const readAndSendFile = useCallback(
    async (
      command: 'pasteImageFile' | 'uploadImageFile',
      file: File,
      extraArgs: unknown[] = [],
    ) => {
      const filePath = (file as any).path;
      if (filePath) {
        postMessage(command, [sourceUri.current, filePath, ...extraArgs]);
      } else {
        try {
          const payload: ImageFilePayload = {
            fileName: file.name,
            mimeType: file.type,
            dataUrl: await readFileAsDataURL(file),
          };
          postMessage(command, [sourceUri.current, payload, ...extraArgs]);
        } catch (error) {
          console.error('Image helper file read failed:', error);
        }
      }
    },
    [postMessage, sourceUri],
  );

  const urlEditorOnKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!urlEditor.current) {
        return;
      }
      if (event.key === 'Enter') {
        let url = urlEditor.current.value.trim();
        if (url.indexOf(' ') >= 0) {
          url = `<${url}>`;
        }
        if (url.length) {
          setShowImageHelper(false);
          postMessage('insertImageUrl', [sourceUri.current, url]);
        }
        return false;
      } else {
        return true;
      }
    },
    [setShowImageHelper, postMessage, sourceUri],
  );

  const dropFilesToCopy = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const files = event.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        readAndSendFile('pasteImageFile', files[i]);
      }
      setShowImageHelper(false);
    },
    [readAndSendFile, setShowImageHelper],
  );


  useEffect(() => {
    if (showImageHelper) {
      imageHelperDialog.current?.showModal();
    } else {
      imageHelperDialog.current?.close();
    }
  }, [imageHelperDialog, showImageHelper]);

  return (
    <dialog
      className={'modal select-none'}
      onClose={() => {
        setShowImageHelper(false);
      }}
      ref={imageHelperDialog}
      data-theme={theme}
    >
      <div className="modal-box">
        <div>
          <div className="mt-3 text-center sm:mt-5">
            <h3 className="text-base font-semibold leading-6">Image helper</h3>
            <div className="mt-2 text-left">
              <div>
                <label
                  htmlFor="link"
                  className="block text-sm font-medium leading-6 "
                >
                  Link
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Enter image URL here, then press 'Enter' to insert."
                    onKeyDown={urlEditorOnKeyDown}
                    className="block w-full rounded-md border-0 px-1.5 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6"
                    ref={urlEditor}
                  />
                </div>
              </div>
              <div className="relative my-4">
                <div className="divider">OR</div>
              </div>
              <div className="">
                <label className="text-sm">
                  Upload image to /assets & insert
                </label>
                <div
                  className="border border-current/10 p-4 rounded-md mt-2 cursor-pointer"
                  onDrop={dropFilesToCopy}
                  onDrag={dropFilesToCopy}
                  onClick={() => {
                    imagePasterInput.current?.click();
                  }}
                >
                  <div className="text-sm">Click me to browse image file</div>
                  <input
                    type="file"
                    className="hidden"
                    multiple={true}
                    ref={imagePasterInput}
                    onChange={(event) => {
                      const files = event.target.files ?? [];
                      for (let i = 0; i < files.length; i++) {
                        readAndSendFile('pasteImageFile', files[i]);
                      }
                      event.target.value = '';
                    }}
                  />
                </div>
              </div>
              <div className="text-sm mt-4">
                <a href="#">Show history</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form method="dialog">
        <button>close</button>
      </form>
    </dialog>
  );
}
