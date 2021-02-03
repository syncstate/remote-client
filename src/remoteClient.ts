import { DocStore } from '@syncstate/core';

export function enableRemote(paths: string | Array<string>) {
  return {
    type: 'ENABLE_REMOTE',
    payload: Array.isArray(paths) ? paths : [paths],
  };
}

export function applyRemote(path: string, change: any) {
  return {
    type: 'APPLY_REMOTE',
    payload: { path, change },
  };
}

export function setLoading(path: string, value: boolean) {
  return {
    type: 'SET_LOADING_REMOTE',
    payload: { path, value },
  };
}

export function getLoading(store: DocStore, path: string) {
  const remoteForPath = store.getState('remote').paths[
    path.replaceAll('/', '::')
  ];
  return remoteForPath ? remoteForPath.loading : false;
}

export function observeStatus(store: DocStore, path: string, callback: any) {
  return store.observe(
    'remote',
    '/paths/' + path.replaceAll('/', '::') + '/loading',
    (loading: any, change: any) => {
      callback(loading);
    }
  );
}
export function onChange(store: DocStore, path: string, callback: any) {
  return store.observe(
    'doc',
    path,
    (dataAtPath: any, change: any) => {
      if (!change.origin && !getLoading(store, path)) {
        // Don't emit for patches received from server
        change = getModifiedChangeForPath(change, path);
        callback(change);
      }
    },
    Infinity
  );
}

export const createInitializer = (pluginName: string = 'remote') => (
  store: DocStore
) => {
  return {
    name: pluginName,
    initialState: {
      paths: {},
    },
    // @ts-ignore
    middleware: reduxStore => next => action => {
      const result = next(action);
      const [remote, setRemote] = store.useSyncState('remote', '/paths');

      switch (action.type) {
        case 'ENABLE_REMOTE':
          {
            setRemote((remote: any) => {
              action.payload.forEach((path: string) => {
                const stringPath = path.replaceAll('/', '::');

                if (!remote[stringPath]) {
                  remote[stringPath] = {
                    loading: false,
                    tempPatches: [],
                  };
                }
              });
            });
          }
          break;

        case 'SET_LOADING_REMOTE':
          {
            setRemote((remote: any) => {
              const stringPath = action.payload.path.replaceAll('/', '::');
              if (remote[stringPath]) {
                remote[stringPath].loading = action.payload.value;
              }
            });
          }
          break;

        case 'APPLY_REMOTE':
          {
            console.log(
              'APPLY_REMOTE patch',
              getModifiedChangeForRoot(
                action.payload.change,
                action.payload.path
              )
            );
            store.dispatch({
              type: 'PATCH',
              payload: {
                ...getModifiedChangeForRoot(
                  action.payload.change,
                  action.payload.path
                ),
                patchType: 'NO_RECORD',
                subtree: 'doc',
              },
            });
          }

          break;
        default:
      }

      return result;
    },
  };
};

function getModifiedChangeForPath(change: any, path: string) {
  return {
    ...change,
    patch: {
      ...change.patch,
      path: change.patch.path.substr(path.length),
    },
    inversePatch: {
      ...change.inversePatch,
      path: change.inversePatch.path.substr(path.length),
    },
  };
}
function getModifiedChangeForRoot(change: any, path: string) {
  return {
    ...change,
    patch: {
      ...change.patch,
      path: path + change.patch.path,
    },
    inversePatch: {
      ...change.inversePatch,
      path: path + change.inversePatch.path,
    },
  };
}
