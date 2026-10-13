package com.sparesbilling.backend.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/states")
public class StateController {

    public record StateResponse(String code, String name) {}

    @GetMapping
    public List<StateResponse> list() {
        return StateCodes.all().entrySet().stream()
                .map(e -> new StateResponse(e.getKey(), e.getValue())).toList();
    }
}