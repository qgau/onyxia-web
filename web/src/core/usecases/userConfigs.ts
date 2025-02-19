import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { Thunks } from "../core";
import { Id } from "tsafe/id";
import { objectKeys } from "tsafe/objectKeys";
import { assert } from "tsafe/assert";
import { createObjectThatThrowsIfAccessed } from "redux-clean-architecture";
import "minimal-polyfills/Object.fromEntries";
import * as userAuthentication from "./userAuthentication";
import type { State as RootState } from "../core";
import { join as pathJoin } from "path";
import { getIsDarkModeEnabledOsDefault } from "onyxia-ui/tools/getIsDarkModeEnabledOsDefault";

/*
 * Values of the user profile that can be changed.
 * Those value are persisted in the secret manager
 * (That is currently vault)
 */

export type UserConfigs = Id<
    Record<string, string | boolean | number | null>,
    {
        kaggleApiToken: string | null;
        gitName: string;
        gitEmail: string;
        gitCredentialCacheDuration: number;
        isBetaModeEnabled: boolean;
        isDevModeEnabled: boolean;
        isDarkModeEnabled: boolean;
        githubPersonalAccessToken: string | null;
        doDisplayMySecretsUseInServiceDialog: boolean;
        selectedProjectId: string | null;
        isCommandBarEnabled: boolean;
    }
>;

export type State = {
    [K in keyof UserConfigs]: {
        value: UserConfigs[K];
        isBeingChanged: boolean;
    };
};

export const name = "userConfigs";

export const { reducer, actions } = createSlice({
    name,
    "initialState": createObjectThatThrowsIfAccessed<State>({
        "debugMessage":
            "The userConfigState should have been initialized during the store initialization"
    }),
    "reducers": {
        "initializationCompleted": (
            ...[, { payload }]: [any, PayloadAction<{ userConfigs: UserConfigs }>]
        ) => {
            const { userConfigs } = payload;

            return Object.fromEntries(
                Object.entries(userConfigs).map(([key, value]) => [
                    key,
                    { value, "isBeingChanged": false }
                ])
            ) as any;
        },
        "changeStarted": (state, { payload }: PayloadAction<ChangeValueParams>) => {
            const wrap = state[payload.key];

            wrap.value = payload.value;
            wrap.isBeingChanged = true;
        },
        "changeCompleted": (
            state,
            { payload }: PayloadAction<{ key: keyof UserConfigs }>
        ) => {
            state[payload.key].isBeingChanged = false;
        }
    }
});

export type ChangeValueParams<K extends keyof UserConfigs = keyof UserConfigs> = {
    key: K;
    value: UserConfigs[K];
};

export const thunks = {
    "changeValue":
        <K extends keyof UserConfigs>(params: ChangeValueParams<K>) =>
        async (...args) => {
            const [dispatch, getState, { secretsManager, oidc }] = args;

            assert(oidc.isUserLoggedIn);

            if (getState().userConfigs[params.key].value === params.value) {
                return;
            }

            dispatch(actions.changeStarted(params));

            const dirPath = await dispatch(privateThunks.getDirPath());

            await secretsManager.put({
                "path": pathJoin(dirPath, params.key),
                "secret": { "value": params.value }
            });

            dispatch(actions.changeCompleted(params));
        },
    "resetHelperDialogs":
        () =>
        (...args) => {
            const [dispatch] = args;

            dispatch(
                thunks.changeValue({
                    "key": "doDisplayMySecretsUseInServiceDialog",
                    "value": true
                })
            );
        }
} satisfies Thunks;

export const protectedThunks = {
    "initialize":
        () =>
        async (...args) => {
            /* prettier-ignore */
            const [dispatch, , { secretsManager, oidc, coreParams }] = args;

            assert(oidc.isUserLoggedIn);

            const { username, email } = dispatch(userAuthentication.thunks.getUser());

            // NOTE: Default values
            const userConfigs: UserConfigs = {
                "kaggleApiToken": null,
                "gitName": username,
                "gitEmail": email,
                "gitCredentialCacheDuration": 0,
                "isBetaModeEnabled": false,
                "isDevModeEnabled": false,
                "isDarkModeEnabled": getIsDarkModeEnabledOsDefault(),
                "githubPersonalAccessToken": null,
                "doDisplayMySecretsUseInServiceDialog": true,
                "selectedProjectId": null,
                "isCommandBarEnabled": coreParams.isCommandBarEnabledByDefault
            };

            const dirPath = await dispatch(privateThunks.getDirPath());

            await Promise.all(
                objectKeys(userConfigs).map(async key => {
                    const path = pathJoin(dirPath, key);

                    const value = await secretsManager
                        .get({ path })
                        .then(({ secret }) => secret["value"])
                        .catch(() => undefined);

                    if (value === undefined) {
                        //Store default value.
                        await secretsManager.put({
                            path,
                            "secret": { "value": userConfigs[key] }
                        });

                        return;
                    }

                    Object.assign(userConfigs, { [key]: value });
                })
            );

            dispatch(actions.initializationCompleted({ userConfigs }));
        }
} satisfies Thunks;

const privateThunks = {
    "getDirPath":
        () =>
        async (...args): Promise<string> => {
            const [, , { onyxiaApi }] = args;

            const userProject = (await onyxiaApi.getUserProjects()).find(
                project => project.group === undefined
            );

            assert(userProject !== undefined);

            return pathJoin("/", userProject.vaultTopDir, ".onyxia");
        }
} satisfies Thunks;

export const selectors = (() => {
    /** Give the value directly (without isBeingChanged) */
    const userConfigs = (rootState: RootState): UserConfigs => {
        const userConfigs: any = {};

        const state = rootState.userConfigs;

        objectKeys(state).forEach(key => (userConfigs[key] = state[key].value));

        return userConfigs;
    };

    return { userConfigs };
})();
