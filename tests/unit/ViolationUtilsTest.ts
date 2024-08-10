import {beforeEach} from '@jest/globals';
import Onyx from 'react-native-onyx';
import ViolationsUtils from '@libs/Violations/ViolationsUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Policy, PolicyCategories, PolicyTagList, Transaction, TransactionViolation} from '@src/types/onyx';

const categoryOutOfPolicyViolation = {
    name: CONST.VIOLATIONS.CATEGORY_OUT_OF_POLICY,
    type: CONST.VIOLATION_TYPES.VIOLATION,
};

const missingCategoryViolation = {
    name: CONST.VIOLATIONS.MISSING_CATEGORY,
    type: CONST.VIOLATION_TYPES.VIOLATION,
};

const customUnitOutOfPolicyViolation = {
    name: CONST.VIOLATIONS.CUSTOM_UNIT_OUT_OF_POLICY,
    type: CONST.VIOLATION_TYPES.VIOLATION,
};

const missingTagViolation = {
    name: CONST.VIOLATIONS.MISSING_TAG,
    type: CONST.VIOLATION_TYPES.VIOLATION,
};

const tagOutOfPolicyViolation = {
    name: CONST.VIOLATIONS.TAG_OUT_OF_POLICY,
    type: CONST.VIOLATION_TYPES.VIOLATION,
};

describe('getViolationsOnyxData', () => {
    let transaction: Transaction;
    let transactionViolations: TransactionViolation[];
    let policy: Policy;
    let policyTags: PolicyTagList;
    let policyCategories: PolicyCategories;

    beforeEach(() => {
        transaction = {transactionID: '123', reportID: '1234', amount: 100, comment: {}, created: '2023-07-24 13:46:20', merchant: 'United Airlines', currency: 'USD'};
        transactionViolations = [];
        policy = {requiresTag: false, requiresCategory: false} as Policy;
        policyTags = {};
        policyCategories = {};
    });

    it('should return an object with correct shape and with empty transactionViolations array', () => {
        const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);

        expect(result).toEqual({
            onyxMethod: Onyx.METHOD.SET,
            key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transaction.transactionID}`,
            value: transactionViolations,
        });
    });

    it('should handle multiple violations', () => {
        transactionViolations = [
            {name: 'duplicatedTransaction', type: CONST.VIOLATION_TYPES.VIOLATION},
            {name: 'receiptRequired', type: CONST.VIOLATION_TYPES.VIOLATION},
        ];
        const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);
        expect(result.value).toEqual(expect.arrayContaining(transactionViolations));
    });

    describe('distance rate was modified', () => {
        beforeEach(() => {
            transactionViolations = [customUnitOutOfPolicyViolation];

            const customUnitRateID = 'rate_id';
            transaction.modifiedCustomUnitRateID = customUnitRateID;
            policy.customUnits = {
                unitId: {
                    attributes: {unit: 'mi'},
                    customUnitID: 'unitId',
                    defaultCategory: 'Car',
                    enabled: true,
                    name: 'Distance',
                    rates: {
                        [customUnitRateID]: {
                            currency: 'USD',
                            customUnitRateID,
                            enabled: true,
                            name: 'Default Rate',
                            rate: 65.5,
                        },
                    },
                },
            };
        });

        it('should remove the customUnitOutOfPolicy violation if the modified one belongs to the policy', () => {
            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);

            expect(result.value).not.toContainEqual(customUnitOutOfPolicyViolation);
        });
    });

    describe('policyRequiresCategories', () => {
        beforeEach(() => {
            policy.requiresCategory = true;
            policyCategories = {Food: {name: 'Food', unencodedName: '', enabled: true, areCommentsRequired: false, externalID: '1234', origin: '12345'}};
            transaction.category = 'Food';
        });

        it('should add missingCategory violation if no category is included', () => {
            transaction.category = undefined;
            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);
            expect(result.value).toEqual(expect.arrayContaining([missingCategoryViolation, ...transactionViolations]));
        });

        it('should add categoryOutOfPolicy violation when category is not in policy', () => {
            transaction.category = 'Bananas';
            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);
            expect(result.value).toEqual(expect.arrayContaining([categoryOutOfPolicyViolation, ...transactionViolations]));
        });

        it('should not include a categoryOutOfPolicy violation when category is in policy', () => {
            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);
            expect(result.value).not.toContainEqual(categoryOutOfPolicyViolation);
        });

        it('should not add a category violation when the transaction is partial', () => {
            const partialTransaction = {...transaction, amount: 0, merchant: CONST.TRANSACTION.PARTIAL_TRANSACTION_MERCHANT, category: undefined};
            const result = ViolationsUtils.getViolationsOnyxData(partialTransaction, transactionViolations, policy, policyTags, policyCategories, false);
            expect(result.value).not.toContainEqual(missingCategoryViolation);
        });

        it('should add categoryOutOfPolicy violation to existing violations if they exist', () => {
            transaction.category = 'Bananas';
            transactionViolations = [
                {name: 'duplicatedTransaction', type: CONST.VIOLATION_TYPES.VIOLATION},
                {name: 'receiptRequired', type: CONST.VIOLATION_TYPES.VIOLATION},
            ];

            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);

            expect(result.value).toEqual(expect.arrayContaining([categoryOutOfPolicyViolation, ...transactionViolations]));
        });

        it('should add missingCategory violation to existing violations if they exist', () => {
            transaction.category = undefined;
            transactionViolations = [
                {name: 'duplicatedTransaction', type: CONST.VIOLATION_TYPES.VIOLATION},
                {name: 'receiptRequired', type: CONST.VIOLATION_TYPES.VIOLATION},
            ];

            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);

            expect(result.value).toEqual(expect.arrayContaining([missingCategoryViolation, ...transactionViolations]));
        });
    });

    describe('policy does not require Categories', () => {
        beforeEach(() => {
            policy.requiresCategory = false;
        });

        it('should not add any violations when categories are not required', () => {
            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);

            expect(result.value).not.toContainEqual(categoryOutOfPolicyViolation);
            expect(result.value).not.toContainEqual(missingCategoryViolation);
        });
    });

    describe('policyRequiresTags', () => {
        beforeEach(() => {
            policy.requiresTag = true;
            policyTags = {
                Meals: {
                    name: 'Meals',
                    required: true,
                    tags: {
                        Lunch: {name: 'Lunch', enabled: true},
                        Dinner: {name: 'Dinner', enabled: true},
                    },
                    orderWeight: 1,
                },
            };
            transaction.tag = 'Lunch';
        });

        it("shouldn't update the transactionViolations if the policy requires tags and the transaction has a tag from the policy", () => {
            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);

            expect(result.value).toEqual(transactionViolations);
        });

        it('should add a missingTag violation if none is provided and policy requires tags', () => {
            transaction.tag = undefined;

            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);

            expect(result.value).toEqual(expect.arrayContaining([{...missingTagViolation}]));
        });

        it('should add a tagOutOfPolicy violation when policy requires tags and tag is not in the policy', () => {
            policyTags = {};

            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);

            expect(result.value).toEqual([]);
        });

        it('should not add a tag violation when the transaction is partial', () => {
            const partialTransaction = {...transaction, amount: 0, merchant: CONST.TRANSACTION.PARTIAL_TRANSACTION_MERCHANT, tag: undefined};
            const result = ViolationsUtils.getViolationsOnyxData(partialTransaction, transactionViolations, policy, policyTags, policyCategories, false);
            expect(result.value).not.toContainEqual(missingTagViolation);
        });

        it('should add tagOutOfPolicy violation to existing violations if transaction has tag that is not in the policy', () => {
            transaction.tag = 'Bananas';
            transactionViolations = [
                {name: 'duplicatedTransaction', type: CONST.VIOLATION_TYPES.VIOLATION},
                {name: 'receiptRequired', type: CONST.VIOLATION_TYPES.VIOLATION},
            ];

            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);

            expect(result.value).toEqual(expect.arrayContaining([{...tagOutOfPolicyViolation}, ...transactionViolations]));
        });

        it('should add missingTag violation to existing violations if transaction does not have a tag', () => {
            transaction.tag = undefined;
            transactionViolations = [
                {name: 'duplicatedTransaction', type: CONST.VIOLATION_TYPES.VIOLATION},
                {name: 'receiptRequired', type: CONST.VIOLATION_TYPES.VIOLATION},
            ];

            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);

            expect(result.value).toEqual(expect.arrayContaining([{...missingTagViolation}, ...transactionViolations]));
        });
    });

    describe('policy does not require Tags', () => {
        beforeEach(() => {
            policy.requiresTag = false;
        });

        it('should not add any violations when tags are not required', () => {
            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);

            expect(result.value).not.toContainEqual(tagOutOfPolicyViolation);
            expect(result.value).not.toContainEqual(missingTagViolation);
        });
    });

    describe('policy has multi level tags', () => {
        beforeEach(() => {
            policy.requiresTag = true;
            policyTags = {
                Department: {
                    name: 'Department',
                    tags: {
                        Accounting: {
                            name: 'Accounting',
                            enabled: true,
                        },
                    },
                    required: true,
                    orderWeight: 2,
                },
                Region: {
                    name: 'Region',
                    tags: {
                        Africa: {
                            name: 'Africa',
                            enabled: true,
                        },
                    },
                    required: true,
                    orderWeight: 1,
                },
                Project: {
                    name: 'Project',
                    tags: {
                        Project1: {
                            name: 'Project1',
                            enabled: true,
                        },
                    },
                    required: true,
                    orderWeight: 3,
                },
            };
        });
        it('should return someTagLevelsRequired when a required tag is missing', () => {
            const someTagLevelsRequiredViolation = {
                name: 'someTagLevelsRequired',
                type: CONST.VIOLATION_TYPES.VIOLATION,
                data: {
                    errorIndexes: [0, 1, 2],
                },
            };

            // Test case where transaction has no tags
            let result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);
            expect(result.value).toEqual([someTagLevelsRequiredViolation]);

            // Test case where transaction has 1 tag
            transaction.tag = 'Africa';
            someTagLevelsRequiredViolation.data = {errorIndexes: [1, 2]};
            result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);
            expect(result.value).toEqual([someTagLevelsRequiredViolation]);

            // Test case where transaction has 2 tags
            transaction.tag = 'Africa::Project1';
            someTagLevelsRequiredViolation.data = {errorIndexes: [1]};
            result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);
            expect(result.value).toEqual([someTagLevelsRequiredViolation]);

            // Test case where transaction has all tags
            transaction.tag = 'Africa:Accounting:Project1';
            result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);
            expect(result.value).toEqual([]);
        });
        it('should return tagOutOfPolicy when a tag is not enabled in the policy but is set in the transaction', () => {
            policyTags.Department.tags.Accounting.enabled = false;
            transaction.tag = 'Africa:Accounting:Project1';
            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, false);
            const violation = {...tagOutOfPolicyViolation, data: {tagName: 'Department'}};
            expect(result.value).toEqual([violation]);
        });
        it('should return missingTag when all dependent tags are enabled in the policy but are not set in the transaction', () => {
            const missingDepartmentTag = {...missingTagViolation, data: {tagName: 'Department'}};
            const missingRegionTag = {...missingTagViolation, data: {tagName: 'Region'}};
            const missingProjectTag = {...missingTagViolation, data: {tagName: 'Project'}};
            transaction.tag = undefined;
            const result = ViolationsUtils.getViolationsOnyxData(transaction, transactionViolations, policy, policyTags, policyCategories, true);
            expect(result.value).toEqual(expect.arrayContaining([missingDepartmentTag, missingRegionTag, missingProjectTag]));
        });
    });
});
