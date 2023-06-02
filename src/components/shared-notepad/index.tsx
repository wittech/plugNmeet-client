import React, { useEffect, useState } from 'react';
import { createSelector } from '@reduxjs/toolkit';

import { RootState, store, useAppSelector } from '../../store';
import { Rnd } from 'react-rnd';

const sharedNotepadFeaturesSelector = createSelector(
  (state: RootState) =>
    state.session.currentRoom.metadata?.room_features.shared_note_pad_features,
  (shared_note_pad_features) => shared_note_pad_features,
);
const lockSharedNotepadSelector = createSelector(
  (state: RootState) =>
    state.session.currentUser?.metadata?.lock_settings?.lock_shared_notepad,
  (lock_shared_notepad) => lock_shared_notepad,
);
const themeSelector = createSelector(
  (state: RootState) => state.roomSettings.theme,
  (theme) => theme,
);

const SharedNotepadElement = () => {
  const sharedNotepadFeatures = useAppSelector(sharedNotepadFeaturesSelector);
  const lockSharedNotepad = useAppSelector(lockSharedNotepadSelector);
  const currentUser = store.getState().session.currentUser;
  const [loaded, setLoaded] = useState<boolean>();
  const [url, setUrl] = useState<string | null>();
  const theme = useAppSelector(themeSelector);

  useEffect(() => {
    if (sharedNotepadFeatures?.is_active && sharedNotepadFeatures.host) {
      let url = sharedNotepadFeatures.host;
      if (sharedNotepadFeatures.host.match('host.docker.internal')) {
        url = 'http://localhost:9001';
      }

      if (currentUser?.isRecorder) {
        setUrl(
          `${url}/p/${sharedNotepadFeatures.read_only_pad_id}?userName=${currentUser?.name}`,
        );
        return;
      }

      if (!lockSharedNotepad) {
        url = `${url}/p/${sharedNotepadFeatures.note_pad_id}?userName=${currentUser?.name}`;
      } else {
        url = `${url}/p/${sharedNotepadFeatures.read_only_pad_id}?userName=${currentUser?.name}`;
      }

      if (theme === 'dark') {
        url += '&theme=monokai';
      } else {
        url += '&theme=normal';
      }

      setUrl(url);
    } else {
      setUrl(null);
    }
    //eslint-disable-next-line
  }, [sharedNotepadFeatures, lockSharedNotepad, theme]);

  const onLoad = () => {
    setLoaded(true);
  };

  const render = () => {
    if (url) {
      return (
        <div className="h-[calc(100%-50px)] sm:px-5 mt-9">
          <Rnd
            default={{
              x: 0,
              y: 0,
              width: '70%',
              height: '95%',
            }}
            minWidth={100}
            minHeight={100}
            bounds="window"
            className="p-1 pt-4 bg-darkPrimary"
          >
            <div className="notepad-wrapper h-full">
              {!loaded ? (
                <div className="loading absolute left-[50%] top-[40%] flex justify-center">
                  <div className="lds-ripple">
                    <div className="border-secondaryColor"></div>
                    <div className="border-secondaryColor"></div>
                  </div>
                </div>
              ) : null}
              <iframe height="100%" width="100%" src={url} onLoad={onLoad} />
            </div>
          </Rnd>
        </div>
      );
    } else {
      return null;
    }
  };

  return <>{render()}</>;
};

export default SharedNotepadElement;
