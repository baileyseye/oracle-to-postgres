plugins {
    java
    id("org.springframework.boot")
    id("io.spring.dependency-management")
}

description = "module-migration"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.aspectj:aspectjweaver")
    compileOnly("org.projectlombok:lombok")
    developmentOnly("org.springframework.boot:spring-boot-devtools")
    runtimeOnly("com.oracle.database.jdbc:ojdbc17")
    annotationProcessor("org.projectlombok:lombok")
}
