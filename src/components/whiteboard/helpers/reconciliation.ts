// eslint-disable-next-line
import { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
// eslint-disable-next-line
import { AppState } from '@excalidraw/excalidraw/types/types';

export type ReconciledElements = readonly ExcalidrawElement[] & {
  _brand: 'reconciledElements';
};

export type BroadcastedExcalidrawElement = ExcalidrawElement & {
  parent?: string;
};

const shouldDiscardRemoteElement = (
  localAppState: AppState,
  local: ExcalidrawElement | undefined,
  remote: BroadcastedExcalidrawElement,
): boolean => {
  return !!(
    local &&
    // local element is being edited
    (local.id === localAppState.editingElement?.id ||
      local.id === localAppState.resizingElement?.id ||
      local.id === localAppState.draggingElement?.id ||
      // local element is newer
      local.version > remote.version ||
      // resolve conflicting edits deterministically by taking the one with
      // the lowest versionNonce
      (local.version === remote.version &&
        local.versionNonce < remote.versionNonce))
  );
};

const getElementsMapWithIndex = <T extends ExcalidrawElement>(
  elements: readonly T[],
) =>
  elements.reduce(
    (
      acc: {
        [key: string]: [element: T, index: number] | undefined;
      },
      element: T,
      idx,
    ) => {
      acc[element.id] = [element, idx];
      return acc;
    },
    {},
  );

export const reconcileElements = (
  localElements: readonly ExcalidrawElement[],
  remoteElements: readonly BroadcastedExcalidrawElement[],
  localAppState: AppState,
): ReconciledElements => {
  const localElementsData =
    getElementsMapWithIndex<ExcalidrawElement>(localElements);

  const reconciledElements: ExcalidrawElement[] = localElements.slice();

  const duplicates = new WeakMap<ExcalidrawElement, true>();

  let cursor = 0;
  let offset = 0;

  let remoteElementIdx = -1;
  for (const remoteElement of remoteElements) {
    remoteElementIdx++;

    const local = localElementsData[remoteElement.id];

    if (shouldDiscardRemoteElement(localAppState, local?.[0], remoteElement)) {
      if (remoteElement.parent) {
        delete remoteElement.parent;
      }

      continue;
    }

    // Mark duplicate for removal as it'll be replaced with the remote element
    if (local) {
      // Unless the ramote and local elements are the same element in which case
      // we need to keep it as we'd otherwise discard it from the resulting
      // array.
      if (local[0] === remoteElement) {
        continue;
      }
      duplicates.set(local[0], true);
    }

    // parent may not be defined in case the remote client is running an older
    // excalidraw version
    const parent =
      remoteElement.parent || remoteElements[remoteElementIdx - 1]?.id || null;

    if (parent != null) {
      delete remoteElement.parent;

      // ^ indicates the element is the first in elements array
      if (parent === '^') {
        offset++;
        if (cursor === 0) {
          reconciledElements.unshift(remoteElement);
          localElementsData[remoteElement.id] = [
            remoteElement,
            cursor - offset,
          ];
        } else {
          reconciledElements.splice(cursor + 1, 0, remoteElement);
          localElementsData[remoteElement.id] = [
            remoteElement,
            cursor + 1 - offset,
          ];
          cursor++;
        }
      } else {
        let idx = localElementsData[parent]
          ? localElementsData[parent]?.[1]
          : null;
        if (idx != null) {
          idx += offset;
        }
        if (idx != null && idx >= cursor) {
          reconciledElements.splice(idx + 1, 0, remoteElement);
          offset++;
          localElementsData[remoteElement.id] = [
            remoteElement,
            idx + 1 - offset,
          ];
          cursor = idx + 1;
        } else if (idx != null) {
          reconciledElements.splice(cursor + 1, 0, remoteElement);
          offset++;
          localElementsData[remoteElement.id] = [
            remoteElement,
            cursor + 1 - offset,
          ];
          cursor++;
        } else {
          reconciledElements.push(remoteElement);
          localElementsData[remoteElement.id] = [
            remoteElement,
            reconciledElements.length - 1 - offset,
          ];
        }
      }
      // no parent z-index information, local element exists → replace in place
    } else if (local) {
      reconciledElements[local[1]] = remoteElement;
      localElementsData[remoteElement.id] = [remoteElement, local[1]];
      // otherwise push to the end
    } else {
      reconciledElements.push(remoteElement);
      localElementsData[remoteElement.id] = [
        remoteElement,
        reconciledElements.length - 1 - offset,
      ];
    }
  }

  const ret: readonly ExcalidrawElement[] = reconciledElements.filter(
    (element) => !duplicates.has(element),
  );

  return ret as ReconciledElements;
};
