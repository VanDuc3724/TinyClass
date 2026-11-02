package com.tinyclass.common.api;

import com.tinyclass.common.web.RequestIdFilter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GlobalExceptionHandlerTests {
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new ProbeController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .addFilters(new RequestIdFilter())
                .build();
    }

    @Test
    void validationReturnsFieldErrorsAndARequestId() throws Exception {
        mvc.perform(post("/probe").header("X-Request-ID", "validation-test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"capacity\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.length()").value(2))
                .andExpect(jsonPath("$.traceId").value("validation-test"));
    }

    @Test
    void malformedJsonDoesNotExposeParserDetails() throws Exception {
        mvc.perform(post("/probe").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_JSON"));
    }

    @Test
    void businessConflictsKeepTheirStatusAndCode() throws Exception {
        mvc.perform(get("/probe/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXAMPLE_CONFLICT"));
    }

    @Test
    void staleVersionsReturnTheSharedConflictContract() throws Exception {
        mvc.perform(get("/probe/version"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    @Test
    void unexpectedFailuresDoNotExposePrivateExceptionDetails() throws Exception {
        var result = mvc.perform(get("/probe/failure"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("private-test-detail");
    }

    @RestController
    static class ProbeController {
        @PostMapping("/probe")
        ApiResponse<ProbeInput> validate(@Valid @RequestBody ProbeInput input) {
            return ApiResponse.of(input);
        }

        @GetMapping("/probe/conflict")
        void conflict() {
            throw new ApiException(HttpStatus.CONFLICT, "EXAMPLE_CONFLICT", "Example conflict");
        }

        @GetMapping("/probe/failure")
        void failure() {
            throw new IllegalStateException("private-test-detail");
        }

        @GetMapping("/probe/version")
        void versionConflict() {
            throw new ObjectOptimisticLockingFailureException(ProbeController.class, "example-id");
        }
    }

    record ProbeInput(@NotBlank String name, @Positive int capacity) {
    }
}
