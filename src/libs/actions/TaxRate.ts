import type {OnyxCollection} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import * as API from '@libs/API';
import type {CreatePolicyTaxParams, SetPolicyTaxesEnabledParams} from '@libs/API/parameters';
import {WRITE_COMMANDS} from '@libs/API/types';
import CONST from '@src/CONST';
import * as ErrorUtils from '@src/libs/ErrorUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Policy, TaxRate} from '@src/types/onyx';
import type {PendingAction} from '@src/types/onyx/OnyxCommon';
import type {OnyxData} from '@src/types/onyx/Request';

let allPolicies: OnyxCollection<Policy>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.POLICY,
    waitForCollectionCallback: true,
    callback: (value) => (allPolicies = value),
});

/**
 * Get tax value with percentage
 */
function getTaxValueWithPercentage(value: string): string {
    return `${value}%`;
}

/**
 * Get new tax object
 */
function getNextTaxID(name: string): string {
    return `id_${name.toUpperCase().replaceAll(' ', '_')}`;
}

function createWorkspaceTax(policyID: string, taxRate: TaxRate) {
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        taxes: {
                            [taxRate.code]: {
                                ...taxRate,
                                pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                                errors: null,
                            },
                        },
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        taxes: {
                            [taxRate.code]: {
                                pendingAction: null,
                                errors: null,
                            },
                        },
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        taxes: {
                            [taxRate.code]: {
                                pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                                errors: ErrorUtils.getMicroSecondOnyxError('workspace.taxes.errors.genericFailureMessage'),
                            },
                        },
                    },
                },
            },
        ],
    };

    const parameters = {
        policyID,
        taxFields: JSON.stringify([
            {
                name: taxRate.name,
                value: taxRate.value,
                enabled: true,
                taxCode: taxRate.code,
            },
        ]),
    } satisfies CreatePolicyTaxParams;

    API.write(WRITE_COMMANDS.CREATE_POLICY_TAX, parameters, onyxData);
}

function clearTaxRateError(policyID: string, taxID: string, pendingAction?: PendingAction) {
    if (pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
        Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {
            taxRates: {
                taxes: {
                    [taxID]: null,
                },
            },
        });
        return;
    }
    Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {
        taxRates: {
            taxes: {
                [taxID]: {pendingAction: null, errors: null},
            },
        },
    });
}

type TaxRateEnabledMap = Record<string, Pick<TaxRate, 'isDisabled' | 'pendingAction'>>;

function setPolicyTaxesEnabled(policyID: string, taxesIDsToUpdate: string[], isEnabled: boolean) {
    const policy = allPolicies?.[`${ONYXKEYS.COLLECTION.POLICY}${policyID}`];
    const originalTaxes = {...policy?.taxRates?.taxes};

    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        taxes: taxesIDsToUpdate.reduce((acc, taxID) => {
                            acc[taxID] = {isDisabled: !isEnabled, pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE};
                            return acc;
                        }, {} as TaxRateEnabledMap),
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        taxes: taxesIDsToUpdate.reduce((acc, taxID) => {
                            acc[taxID] = {isDisabled: !isEnabled, pendingAction: null};
                            return acc;
                        }, {} as TaxRateEnabledMap),
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.POLICY}${policyID}`,
                value: {
                    taxRates: {
                        taxes: taxesIDsToUpdate.reduce((acc, taxID) => {
                            acc[taxID] = {isDisabled: !!originalTaxes[taxID].isDisabled, pendingAction: null};
                            return acc;
                        }, {} as TaxRateEnabledMap),
                    },
                },
            },
        ],
    };

    const parameters = {
        policyID,
        taxFields: JSON.stringify(taxesIDsToUpdate.map((taxID) => ({taxCode: taxID, enabled: isEnabled}))),
    } satisfies SetPolicyTaxesEnabledParams;

    console.log({parameters});

    API.write(WRITE_COMMANDS.SET_POLICY_TAXES_ENABLED, parameters, onyxData);
}

export {createWorkspaceTax, clearTaxRateError, getNextTaxID, getTaxValueWithPercentage, setPolicyTaxesEnabled};
