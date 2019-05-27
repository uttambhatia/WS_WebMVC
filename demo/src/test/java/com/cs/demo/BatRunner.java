package com.cs.demo;
import java.io.File;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.file.Files;

import org.apache.commons.io.FileUtils;
import org.codehaus.plexus.util.cli.CommandLineException;
import org.codehaus.plexus.util.cli.CommandLineUtils;
import org.codehaus.plexus.util.cli.Commandline;
import org.codehaus.plexus.util.cli.WriterStreamConsumer;
public class BatRunner {
	
	public BatRunner()  throws Exception{
		
		String batfile = "run.bat";
		String directory = "D:\\Vannilla\\demo\\src\\test\\resources";
		try {
			runProcess(batfile, directory);
		} catch (CommandLineException e) {
			e.printStackTrace();
		}
		
	}
	
	public void runProcess(String batfile, String directory) throws Exception {
		
		
		Commandline commandLine = new Commandline();
		
		File executable = new File(directory + "/" +batfile);
		
		String newCmd = "java -jar D:/Vannilla/demo/target/demo-0.0.1-SNAPSHOT.jar";
		
		File tempFile = File.createTempFile("run", ".bat");
		FileUtils.writeStringToFile(tempFile, newCmd);
		
		commandLine.setExecutable(tempFile.getAbsolutePath());
		
		WriterStreamConsumer systemOut = new WriterStreamConsumer(
	            new OutputStreamWriter(System.out));
		
		WriterStreamConsumer systemErr = new WriterStreamConsumer(
	            new OutputStreamWriter(System.out));

		
		Thread runner = new Thread(new Runnable() {
			
			@Override
			public void run() {
				int returnCode;
				try {
					returnCode = CommandLineUtils.executeCommandLine(commandLine, systemOut, systemErr);
					if (returnCode != 0) {
					    System.out.println("Something Bad Happened!");
					} else {
					    System.out.println("Taaa!! ddaaaaa!!");
					};
				} catch (CommandLineException e) {
				}		
				
				
			}
		});
		
		runner.start();		
		
	}

	/**
	 * @param args
	 */
	public static void main(String[] args) throws Exception{
		new BatRunner();
	}
}
