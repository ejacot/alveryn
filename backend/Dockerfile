FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw --batch-mode dependency:go-offline
COPY src src
RUN ./mvnw --batch-mode -DskipTests clean package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ffmpeg imagemagick tesseract-ocr tesseract-ocr-deu tesseract-ocr-eng \
      tesseract-ocr-fra tesseract-ocr-ita tesseract-ocr-nld tesseract-ocr-pol \
      tesseract-ocr-ron tesseract-ocr-rus tesseract-ocr-spa \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /workspace/target/app.jar app.jar
RUN useradd --system --uid 10001 alveryn
USER 10001
EXPOSE 10000
ENTRYPOINT ["sh", "-c", "if [ \"${DB_URL#postgresql://}\" != \"$DB_URL\" ]; then DB_AUTHLESS=\"${DB_URL#postgresql://}\"; DB_AUTHLESS=\"${DB_AUTHLESS#*@}\"; export DB_URL=\"jdbc:postgresql://${DB_AUTHLESS}\"; fi; exec java -jar /app/app.jar"]
