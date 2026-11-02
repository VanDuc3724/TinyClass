package com.tinyclass.classes;

import com.tinyclass.common.persistence.BaseEntity;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "classes")
public class LearningClass extends BaseEntity {
    @Column(name = "teacher_id", nullable = false)
    private UUID teacherId;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(columnDefinition = "text")
    private String description;
    @Column(name = "min_age_months")
    private Integer minAgeMonths;
    @Column(name = "max_age_months")
    private Integer maxAgeMonths;
    private Integer capacity;
    @Column(length = 300)
    private String location;
    @Column(name = "start_date")
    private LocalDate startDate;
    @Column(name = "end_date")
    private LocalDate endDate;
    @Column(nullable = false, length = 20)
    private String status = "DRAFT";
    @Column(name = "archived_from_status", length = 20)
    private String archivedFromStatus;

    protected LearningClass() {}
    public LearningClass(UUID teacherId, ClassDtos.ClassInput input) { this.teacherId = teacherId; edit(input); }
    public void edit(ClassDtos.ClassInput input) {
        name = input.name().strip(); description = clean(input.description());
        minAgeMonths = input.minAgeMonths(); maxAgeMonths = input.maxAgeMonths();
        capacity = input.capacity(); location = clean(input.location());
        startDate = input.startDate(); endDate = input.endDate();
    }
    public void activate() { status = "ACTIVE"; }
    public void complete() { status = "COMPLETED"; }
    public void archive() { archivedFromStatus = status; status = "ARCHIVED"; }
    public void restore() { status = archivedFromStatus; archivedFromStatus = null; }
    static String clean(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    public UUID getTeacherId() { return teacherId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public Integer getMinAgeMonths() { return minAgeMonths; }
    public Integer getMaxAgeMonths() { return maxAgeMonths; }
    public Integer getCapacity() { return capacity; }
    public String getLocation() { return location; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public String getStatus() { return status; }
}
