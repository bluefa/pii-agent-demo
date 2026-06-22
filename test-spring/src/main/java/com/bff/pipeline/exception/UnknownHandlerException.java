package com.bff.pipeline.exception;

/** Thrown when a handler_key cannot be resolved in the registry -> task FAILED (HANDLER_NOT_FOUND). */
public class UnknownHandlerException extends RuntimeException {
    public UnknownHandlerException(String key) {
        super("Unknown handler_key: " + key);
    }
}
