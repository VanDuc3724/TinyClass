package com.tinyclass.learning;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;

public final class LibraryDtos {
    private LibraryDtos() {}
    public record TopicInput(@NotBlank @Size(max=100) String name,@Size(max=3000) String description,Long version,Boolean archived) {
        public TopicInput { archived=Boolean.TRUE.equals(archived); }
    }
    public record BlockInput(@NotBlank @Pattern(regexp="TEXT|IMAGE|AUDIO|VIDEO|PDF") String type,@Size(max=20000) String textContent,
            UUID fileId,@Size(max=500) String caption,@Size(max=500) String altText) {}
    public record LessonInput(@NotBlank @Size(max=200) String title,@Size(max=1000) String summary,@Size(max=10000) String parentGuidance,
            @Size(max=20000) String activityInstructions,@Min(1) @Max(240) Integer estimatedMinutes,
            @NotNull @Pattern(regexp="REFERENCE|PARENT_CONFIRM|TEACHER_REVIEW") String defaultCompletionMode,
            @NotNull @Size(max=4) List<@Pattern(regexp="TEXT|IMAGE|AUDIO|VIDEO") String> defaultResponseTypes,
            @NotNull @Size(max=30) List<@NotNull UUID> topicIds,@NotNull @Size(max=50) List<@Valid BlockInput> blocks,
            Long version,Boolean acknowledgeSharedUpdate) {
        public LessonInput { acknowledgeSharedUpdate=Boolean.TRUE.equals(acknowledgeSharedUpdate); }
    }
    public record CourseLessonInput(@NotNull UUID lessonId,boolean isRequired) {}
    public record CourseInput(@NotBlank @Size(max=200) String title,@Size(max=10000) String description,
            @Min(0) @Max(216) Integer minAgeMonths,@Min(0) @Max(216) Integer maxAgeMonths,
            @NotNull @Size(max=100) List<@Valid CourseLessonInput> lessons,Long version,Boolean acknowledgeSharedUpdate) {
        public CourseInput { acknowledgeSharedUpdate=Boolean.TRUE.equals(acknowledgeSharedUpdate); }
    }
    public record ActionInput(@NotNull Long version,@Size(max=1000) String reason) {}
}
