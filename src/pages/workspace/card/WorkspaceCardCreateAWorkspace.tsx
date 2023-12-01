import React from 'react';
import Button from '@components/Button';
import * as Illustrations from '@components/Icon/Illustrations';
import Section from '@components/Section';
import withLocalize, {WithLocalizeProps} from '@components/withLocalize';
import useThemeStyles from '@styles/useThemeStyles';

type WorkspaceCardCreateAWorkspaceProps = WithLocalizeProps;

function WorkspaceCardCreateAWorkspace({translate}: WorkspaceCardCreateAWorkspaceProps) {
    const styles = useThemeStyles();

    return (
        <Section
            title={translate('workspace.card.createAWorkspace')}
            icon={Illustrations.CreditCardsNew}
            subtitle={translate('workspace.card.createAWorkspaceCopy')}
            containerStyles={[styles.highlightBG]}
        >
            <Button
                text={translate('workspace.card.createAWorkspaceCTA')}
                style={styles.mt5}
                success
            />
        </Section>
    );
}

WorkspaceCardCreateAWorkspace.displayName = 'WorkspaceCardNoVBAView';

export default withLocalize(WorkspaceCardCreateAWorkspace);
