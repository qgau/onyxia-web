import type { Thunks } from "core/core";
import { waitForDebounceFactory } from "core/tools/waitForDebounce";
import { createUsecaseContextApi } from "redux-clean-architecture";
import { actions, name, type State } from "./state";
import { assert } from "tsafe/assert";
import { is } from "tsafe/is";
import memoize from "memoizee";
import FlexSearch from "flexsearch";
import { getMatchPositions } from "core/tools/highlightMatches";
import { Chart } from "core/ports/OnyxiaApi";

export const thunks = {
    "changeSelectedCatalogId":
        (params: { catalogId: string | undefined }) =>
        async (...args) => {
            const [dispatch, getState, { onyxiaApi }] = args;

            const state = getState()[name];

            if (state.stateDescription === "ready") {
                if (params.catalogId === undefined) {
                    dispatch(actions.defaultCatalogSelected());
                    return;
                }

                if (state.selectedCatalogId === params.catalogId) {
                    return;
                }

                dispatch(
                    actions.selectedCatalogChanged({
                        "selectedCatalogId": params.catalogId
                    })
                );

                return;
            }

            if (state.isFetching) {
                return;
            }

            dispatch(actions.catalogsFetching());

            const { catalogs, chartsByCatalogId } =
                await onyxiaApi.getCatalogsAndCharts();

            const selectedCatalogId =
                params.catalogId ?? catalogs.filter(({ isHidden }) => !isHidden)[0].id;

            dispatch(
                actions.catalogsFetched({
                    catalogs,
                    "chartsByCatalogId": (() => {
                        const out: State.Ready["chartsByCatalogId"] = {};

                        Object.keys(chartsByCatalogId).forEach(
                            catalogId =>
                                (out[catalogId] = chartsByCatalogId[catalogId].map(
                                    chart => {
                                        const defaultVersion =
                                            Chart.getDefaultVersion(chart);

                                        const {
                                            description = "",
                                            iconUrl,
                                            projectHomepageUrl
                                        } = chart.versions.find(
                                            ({ version }) => version === defaultVersion
                                        )!;

                                        return {
                                            "name": chart.name,
                                            description,
                                            iconUrl,
                                            projectHomepageUrl
                                        };
                                    }
                                ))
                        );

                        return out;
                    })(),
                    selectedCatalogId
                })
            );

            if (params.catalogId === undefined) {
                dispatch(actions.defaultCatalogSelected());
            }
        },
    "setSearch":
        (params: { search: string }) =>
        async (...args) => {
            const { search } = params;
            const [dispatch, getState, extra] = args;

            const { evtAction } = extra;

            const { waitForSearchDebounce, getFlexSearch } = getContext(extra);

            await waitForSearchDebounce();

            if (getState()[name].stateDescription === "not fetched") {
                await evtAction.waitFor(
                    action =>
                        action.sliceName === name &&
                        action.actionName === "catalogsFetched"
                );
            }

            dispatch(actions.searchChanged({ search }));

            if (search === "") {
                dispatch(actions.searchResultChanged({ "searchResults": undefined }));
                return;
            }

            const state = getState()[name];

            assert(state.stateDescription === "ready");

            const { flexSearch } = getFlexSearch(state.catalogs, state.chartsByCatalogId);

            dispatch(
                actions.searchResultChanged({
                    "searchResults": await flexSearch({ search })
                })
            );
        }
} satisfies Thunks;

const { getContext } = createUsecaseContextApi(() => {
    const { waitForDebounce } = waitForDebounceFactory({ "delay": 200 });

    const getFlexSearch = memoize(
        (
            catalogs: State.Ready["catalogs"],
            chartsByCatalogId: State.Ready["chartsByCatalogId"]
        ) => {
            const index = new FlexSearch.Document<{
                catalogIdChartName: `${string}/${string}`;
                chartNameAndDescription: `${string} ${string}`;
            }>({
                "document": {
                    "id": "catalogIdChartName",
                    "field": ["chartNameAndDescription"]
                },
                "cache": 100,
                "tokenize": "full",
                "context": {
                    "resolution": 9,
                    "depth": 2,
                    "bidirectional": true
                }
            });

            Object.entries(chartsByCatalogId)
                .filter(
                    ([catalogId]) =>
                        !catalogs.find(({ id }) => id === catalogId)!.isHidden
                )
                .forEach(([catalogId, charts]) =>
                    charts.forEach(chart =>
                        index.add({
                            "catalogIdChartName": `${catalogId}/${chart.name}`,
                            "chartNameAndDescription": `${chart.name} ${chart.description}`
                        })
                    )
                );

            async function flexSearch(params: {
                search: string;
            }): Promise<State.SearchResult[]> {
                const { search } = params;

                const flexSearchResults = await index.searchAsync(search, {
                    "bool": "or",
                    "suggest": true,
                    "enrich": true
                });

                if (flexSearchResults.length === 0) {
                    return [];
                }

                const [{ result: catalogIdChartNames }] = flexSearchResults;

                assert(is<`${string}/${string}`[]>(catalogIdChartNames));

                return catalogIdChartNames.map(
                    (catalogIdChartName): State.SearchResult => {
                        const [catalogId, chartName] = catalogIdChartName.split("/");

                        return {
                            catalogId,
                            chartName,
                            "chartNameHighlightedIndexes": getMatchPositions({
                                search,
                                "text": chartName
                            }),
                            "chartDescriptionHighlightedIndexes": getMatchPositions({
                                search,
                                "text": chartsByCatalogId[catalogId].find(
                                    chart => chart.name === chartName
                                )!.description
                            })
                        };
                    }
                );
            }

            return { flexSearch };
        },
        { "max": 1 }
    );

    return {
        "waitForSearchDebounce": waitForDebounce,
        getFlexSearch
    };
});
