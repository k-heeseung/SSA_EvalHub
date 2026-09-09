package com.example.evalhub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class EvalhubApplication {

	public static void main(String[] args) {
		SpringApplication.run(EvalhubApplication.class, args);
	}

}
