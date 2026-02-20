import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VerticalStepper } from '@/components/ui/vertical-stepper';
import type { Liquidation } from '@/types/liquidation';

interface WorkflowProgressCardProps {
    liquidation: Liquidation;
    isHEIUser: boolean;
}

function getWorkflowSteps(liquidation: Liquidation, isHEIUser: boolean) {
    const normalizedStatus = liquidation.liquidation_status?.toLowerCase().replace(/\s+/g, '_') || 'draft';

    if (isHEIUser) {
        const heiSteps = [
            { label: 'HEI Submission', description: 'Draft & Submit' },
            { label: 'RC Review', description: 'Regional Coordinator' },
            { label: 'Completed', description: 'Liquidation Complete' },
        ];

        const rcDoneStatuses = ['fully_liquidated', 'partially_liquidated'];
        if (rcDoneStatuses.includes(normalizedStatus)) {
            return { steps: heiSteps, currentStep: 3, isFullyCompleted: true, lastCompletedStep: undefined };
        }

        const stepMap: Record<string, number> = {
            'draft': 1, 'unliquidated': 1,
            'for_initial_review': 2, 'returned_to_hei': 2,
        };
        return { steps: heiSteps, currentStep: stepMap[normalizedStatus] || 1, isFullyCompleted: false, lastCompletedStep: undefined };
    }

    const rcSteps = [
        { label: 'HEI Submission', description: 'Draft & Submit' },
        { label: 'RC Review', description: 'Regional Coordinator' },
        { label: 'Accounting Review', description: 'Financial Verification' },
        { label: 'COA Endorsement', description: 'Final Approval' },
    ];

    const rcDoneStatuses = ['fully_liquidated', 'partially_liquidated'];
    const accountingCurrentStatuses = ['endorsed_to_accounting', 'returned_to_rc'];
    const coaCurrentStatuses = ['endorsed_to_coa'];

    if (coaCurrentStatuses.includes(normalizedStatus)) {
        return { steps: rcSteps, currentStep: 4, isFullyCompleted: false, lastCompletedStep: undefined };
    }
    if (accountingCurrentStatuses.includes(normalizedStatus)) {
        return { steps: rcSteps, currentStep: 3, isFullyCompleted: false, lastCompletedStep: undefined };
    }
    if (rcDoneStatuses.includes(normalizedStatus)) {
        return { steps: rcSteps, currentStep: 2, isFullyCompleted: false, lastCompletedStep: 2 };
    }

    const stepMap: Record<string, number> = {
        'draft': 1, 'unliquidated': 1,
        'for_initial_review': 2, 'returned_to_hei': 2,
    };
    return { steps: rcSteps, currentStep: stepMap[normalizedStatus] || 1, isFullyCompleted: false, lastCompletedStep: undefined };
}

export default function WorkflowProgressCard({ liquidation, isHEIUser }: WorkflowProgressCardProps) {
    const workflowState = useMemo(() => getWorkflowSteps(liquidation, isHEIUser), [liquidation, isHEIUser]);

    return (
        <Card className="flex-1">
            <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-semibold">Workflow Progress</CardTitle>
                <CardDescription className="text-xs">Track liquidation status</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
                <VerticalStepper
                    steps={workflowState.steps}
                    currentStep={workflowState.currentStep}
                    isFullyCompleted={workflowState.isFullyCompleted}
                    lastCompletedStep={workflowState.lastCompletedStep}
                />
            </CardContent>
        </Card>
    );
}
