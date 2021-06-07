
import { createUseClassNames } from "app/theme";
import { memo } from "react";
import { Button } from "app/theme";
import { useTranslation } from "app/i18n/useTranslations";
import { useCallbackFactory } from "powerhooks";
import type { IconId } from "app/theme";


export type Action = "refresh" | "rename" | "create file" | "create directory" | "delete" | "copy path";

export type Props = {
    /** [HIGHER ORDER] */
    wordForFile: "file" | "secret";


    selectedItemKind: "file" | "directory" | "none";
    isSelectedItemInEditingState: boolean;
    isViewingFile: boolean;

    callback(params: { action: Action; }): void;

};

const { useClassNames } = createUseClassNames<Props>()(
    theme => ({
        "root": {
            "backgroundColor": theme.colors.useCases.surfaces.surface1,
            "boxShadow": theme.shadows[1],
            "borderRadius": "8px 0 0 8px",
            "overflow": "hidden"
        }
    })
);

export const ExplorerButtonBar = memo((props: Props) => {

    const {
        wordForFile,
        callback,
        selectedItemKind,
        isSelectedItemInEditingState,
        isViewingFile
    } = props;

    const { classNames } = useClassNames(props);

    const { t } = useTranslation("ExplorerButtonBar");

    const onClickFactory = useCallbackFactory<[Action], []>(
        ([action]) => callback({ action })
    );

    return (
        <div className={classNames.root}>
            { ([
                "refresh",
                "create file",
                "create directory",
                "copy path",
                "rename",
                "delete",
            ] as const).map(action =>
                <CustomButton
                    startIcon={(() => {
                        switch (action) {
                            case "refresh": return "cached" as const;
                            case "copy path": return "filterNone";
                            case "create directory": return "add";
                            case "create file": return "add";
                            case "delete": return "delete";
                            case "rename": return "edit";
                        }
                    })()}
                    disabled={(() => {
                        switch (action) {
                            case "refresh": return false;
                            case "rename": return (
                                isSelectedItemInEditingState || 
                                selectedItemKind === "none" || 
                                isViewingFile
                            );
                            case "create file":
                            case "create directory": return isViewingFile;
                            case "delete": return selectedItemKind === "none" || isViewingFile;
                            case "copy path": return selectedItemKind !== "file" && !isViewingFile;
                        }
                    })()
                    }
                    key={action}
                    onClick={onClickFactory(action)}

                >
                    {
                        action === "create file" ?
                            t("create what", { "what": t(wordForFile) }) :
                            t(action)
                    }
                </CustomButton>
            )}
        </div>
    );

});
export declare namespace ExplorerButtonBar {
    export type I18nScheme = Record<Exclude<Action, "create file">, undefined> & {
        "create what": { what: string; };
        secret: undefined;
        file: undefined;
    };
}

const { CustomButton } = (() => {

    type CustomButtonProps = {
        startIcon: IconId;
        disabled: boolean;
        onClick(): void;
        children: React.ReactNode;
    };

    const { useClassNames } = createUseClassNames<CustomButtonProps>()(
        theme => ({
            "root": {
                "backgroundColor": "transparent",
                "borderRadius": "unset",
                "borderColor": "transparent",
                "&.Mui-disabled .MuiButton-label": {
                    "color": theme.colors.useCases.typography.textDisabled
                },
                "& .MuiButton-label": {
                    "color": theme.colors.useCases.typography.textPrimary
                },
                "&:active .MuiButton-label": {
                    "color": theme.colors.useCases.typography.textFocus,
                    "& .MuiSvgIcon-root": {
                        "color": theme.colors.useCases.typography.textFocus
                    }
                },
                "& .MuiTouchRipple-root": {
                    "display": "none"
                },
                "transition": "none",
                "& > *": {
                    "transition": "none"
                },
                "&:hover": {
                    "borderBottomColor": theme.colors.useCases.buttons.actionActive,
                    "boxSizing": "border-box",
                    "backgroundColor": "unset",
                    "& .MuiSvgIcon-root": {
                        "color": theme.colors.useCases.typography.textPrimary
                    }
                }
            }
        })
    );

    function CustomButton(props: CustomButtonProps) {

        const { startIcon, disabled, onClick, children } = props;

        const { classNames } = useClassNames(props);

        return (
            <Button
                className={classNames.root}
                color="secondary"
                startIcon={startIcon}
                {...{ disabled, onClick }}
            >
                {children}
            </Button>
        );

    }

    return { CustomButton };


})();
