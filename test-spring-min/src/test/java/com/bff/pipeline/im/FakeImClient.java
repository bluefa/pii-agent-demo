package com.bff.pipeline.im;

/**
 * The IM test seam (fakes, never mocks): the test scripts each call's behavior before the tick fires it. A
 * behavior returns a value or throws — a throw is a retriable failure; a {@link SlowCall} forces the per-call
 * timeout (CALL_TIMEOUT) by blocking past it.
 */
public final class FakeImClient implements ImClient {

    @FunctionalInterface
    public interface Dispatch {
        String run();
    }

    @FunctionalInterface
    public interface Poll {
        TerraformPoll run();
    }

    @FunctionalInterface
    public interface Check {
        boolean run();
    }

    private Dispatch dispatch = () -> "job-1";
    private Poll poll = TerraformPoll::running;
    private Check check = () -> false;

    public void onDispatch(Dispatch dispatch) {
        this.dispatch = dispatch;
    }

    public void onPoll(Poll poll) {
        this.poll = poll;
    }

    public void onCheck(Check check) {
        this.check = check;
    }

    /** A behavior that blocks well past the test's small per-call timeout, so the call is abandoned (CALL_TIMEOUT). */
    public static void sleepPastTimeout() {
        try {
            Thread.sleep(2_000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public String runTerraform(String target, String operation) {
        return dispatch.run();
    }

    @Override
    public TerraformPoll terraformJobStatus(String jobId) {
        return poll.run();
    }

    @Override
    public boolean checkCondition(String target, String operation) {
        return check.run();
    }
}
