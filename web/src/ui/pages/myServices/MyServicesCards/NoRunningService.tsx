import { memo } from "react";
import { tss, Text } from "ui/theme";
import { useTranslation } from "ui/i18n";
import { ReactComponent as ServiceNotFoundSvg } from "ui/assets/svg/ServiceNotFound.svg";
import MuiLink from "@mui/material/Link";
import type { Link } from "type-route";
import { declareComponentKeys } from "i18nifty";

type Props = {
    className: string;
    catalogExplorerLink: Link;
};

export const NoRunningService = memo((props: Props) => {
    const { className, catalogExplorerLink } = props;

    const { classes, cx } = useStyles();

    const { t } = useTranslation({ NoRunningService });

    return (
        <div className={cx(classes.root, className)}>
            <div className={classes.innerDiv}>
                <ServiceNotFoundSvg className={classes.svg} />
                <Text typo="page heading" className={classes.h2}>
                    {t("no services running")}
                </Text>
                <MuiLink
                    className={classes.link}
                    {...catalogExplorerLink}
                    underline="hover"
                >
                    {t("launch one")}
                </MuiLink>
            </div>
        </div>
    );
});

export const { i18n } = declareComponentKeys<"no services running" | "launch one">()({
    NoRunningService
});

const useStyles = tss.withName({ NoRunningService }).create(({ theme }) => ({
    "root": {
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center"
    },
    "innerDiv": {
        "textAlign": "center",
        "maxWidth": 500
    },
    "svg": {
        "fill": theme.colors.palette.dark.greyVariant2,
        "width": 100,
        "margin": 0
    },
    "h2": {
        ...theme.spacing.topBottom("margin", 5)
    },
    "link": {
        "cursor": "pointer"
    }
}));
